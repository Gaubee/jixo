process.removeAllListeners("warning");

import {blue, bold, createResolver, cyan, green, italic, magenta, normalizeFilePath, prompts, red, underline, yellow, type PathResolver} from "@gaubee/nodekit";
import {iter_map_not_null} from "@gaubee/util";
import {parseArgs} from "@std/cli/parse-args";
import {globbySync, isDynamicPattern} from "globby";
import {import_meta_ponyfill} from "import-meta-ponyfill";
import fs from "node:fs";
import path from "node:path";
import prettier from "prettier";
import {simpleGit} from "simple-git";
import {match} from "ts-pattern";

const fsp = fs.promises;

// --- 日志记录器 ---
const logger = {
  info: (message: string) => console.log(cyan("[INFO]"), message),
  success: (message: string) => console.log(green("[SUCCESS]"), message),
  warn: (message: string) => console.log(yellow("[WARN]"), message),
  error: (message: string) => console.error(red("[ERROR]"), message),
  file: (filePath: string) => magenta(filePath),
  mode: (mode: DiffFileMode) =>
    match(mode)
      .with("add", () => green("❇️"))
      .with("modify", () => yellow("✏️"))
      .with("delete", () => red("❌"))
      .with("rename", () => red("🔄"))
      .with("rename+modify", () => red("🔀"))
      .exhaustive(),
};

type FormatCodeOptions = {
  filepath: string;
  prettierParser?: prettier.LiteralUnion<prettier.BuiltInParserName, string>;
};
const formatCode = async (filecode: string, {filepath, prettierParser}: FormatCodeOptions) => {
  const fileInfo = await prettier.getFileInfo(filepath);
  if (fileInfo.ignored) {
    logger.info(`文件 ${path.relative(process.cwd(), filepath)} 已被 .prettierignore 忽略。`);
    return filecode;
  }

  const fileparser = prettierParser ?? fileInfo?.inferredParser;

  if (!fileparser) {
    logger.warn(`无法推断文件 ${path.relative(process.cwd(), filepath)} 的解析器，跳过格式化。`);
    return filecode;
  }
  const config = await prettier.resolveConfig(filepath);

  filecode = await prettier.format(filecode, {
    ...config,
    parser: fileparser,
  });
  return filecode;
};

type DiffFileMode = "add" | "delete" | "modify" | "rename" | "rename+modify";
type DiffFile = {
  from: string;
  filePath: string;
  code: string;
  fullSourcePath: string;
  fullTargetPath: string;
  mode: DiffFileMode;
  safe: boolean;
};
type DiffFiles = Array<DiffFile>;

type GitCommitMessage = {
  title: string;
  detail: string;
  all: string;
};

interface AiResponse {
  fromFilepath: string;
  gitCommitMessage: GitCommitMessage | null;
  diffFiles: DiffFiles;
}

/**
 * 解析包含多个文件代码块的 Markdown 文本。
 * @param markdownContent - 从文件中读取的 Markdown 全文。
 * @returns 一个包含文件路径和代码内容的对象数组。
 */
async function parseMarkdown(from: string, markdownContent: string, rootResolver: PathResolver) {
  const gitCommitMessageRegex = /【变更日志】[*\s\n]+`{3,4}[\w]*\s*\n([\s\S]*?)\n`{3,4}/;
  const gitCommitMessageMatchRes = markdownContent.match(gitCommitMessageRegex);
  let gitCommitMessage: GitCommitMessage | null = null;
  if (gitCommitMessageMatchRes) {
    const gitCommitMessageContent = gitCommitMessageMatchRes[1].trim();
    const [title, ...detailLines] = gitCommitMessageContent.split("\n");
    gitCommitMessage = {
      title: title.trim(),
      detail: detailLines.join("\n").trim(),
      all: "",
    };

    gitCommitMessage.all = `${gitCommitMessage.title}\n\n${gitCommitMessage.detail}\n`;
  }

  // 正则表达式，用于匹配文件路径标题和对应的代码块
  // 匹配 `#### ` 开头，后面跟着路径，直到换行符
  // 然后非贪婪地匹配 ` ``` ` 代码块之间的所有内容
  const fileBlockRegex = /\#{4}[\s\*]+`(.+?)`[\s\S]*?\n`{3,4}[\w]*\s*\n([\s\S]*?)\n`{3,4}/g;
  const diffFiles: DiffFiles = [];

  logger.info("Parsing Markdown content to find file blocks...");

  for (const match of markdownContent.matchAll(fileBlockRegex)) {
    const filePath = match[1].trim();
    let code = match[2].trim();
    const fullSourcePath = rootResolver(filePath);
    let fullTargetPath = fullSourcePath;
    let mode: DiffFileMode | undefined;
    if (code === "$$DELETE_FILE$$") {
      mode = "delete";
    } else if (code.startsWith("$$RENAME_FILE$$")) {
      const firstLineIndex = code.indexOf("\n");
      if (firstLineIndex !== -1) {
        mode = "rename+modify";
        fullTargetPath = rootResolver(code.slice(0, firstLineIndex).replace("$$RENAME_FILE$$", ""));
        code = code.slice(firstLineIndex + 1);
      } else {
        mode = "rename";
        fullTargetPath = rootResolver(code.replace("$$RENAME_FILE$$", ""));
        code = "";
      }
    } else if (fs.existsSync(fullSourcePath)) {
      mode = "modify";
    } else {
      mode = "add";
    }
    if (mode == null) {
      console.error("ERROR:", filePath, code);
      throw new Error(`Invalid parse mode for filepath: ${filePath}`);
    }
    // --- 安全检查 ---
    // 确保目标路径在项目根目录内，防止路径遍历攻击
    let safe = normalizeFilePath(fullSourcePath).startsWith(normalizeFilePath(rootResolver.dirname) + "/");
    // if (!safe) {
    //   logger.error(`unsafe file path: ${logger.file(filePath)}.`);
    // }

    diffFiles.push({from, filePath, code, fullSourcePath, fullTargetPath, mode, safe});
  }

  if (diffFiles.length === 0) {
    logger.warn("No valid file blocks found in the Markdown content.");
  } else {
    logger.success(`Found ${diffFiles.length} file blocks to process.`);
  }

  return {fromFilepath: from, gitCommitMessage, diffFiles} satisfies AiResponse;
}

/**
 * 将解析出的代码内容安全地写入到本地文件系统。
 * @param files - 从 Markdown 解析出的文件对象数组。
 */
async function applyChanges(files: DiffFiles, format?: boolean): Promise<void> {
  for (const file of files) {
    const writeFile = async (filepath = file.fullSourcePath, filecode: string = file.code) => {
      if (format) {
        filecode = await formatCode(filecode, {filepath});
      }
      await fsp.writeFile(filepath, filecode, "utf-8");
    };
    try {
      await match(file.mode)
        .with("add", "modify", async () => {
          // 确保目标目录存在
          const dirName = path.dirname(file.fullSourcePath);
          await fsp.mkdir(dirName, {recursive: true});

          // 写入文件
          await writeFile();
          logger.success(`Successfully ${file.mode === "add" ? "writed" : "updated"} file: ${logger.file(file.filePath)}`);
        })
        .with("delete", async () => {
          await fsp.rm(file.fullSourcePath, {recursive: true, force: true});
          logger.success(`Successfully deleted file: ${logger.file(file.filePath)}`);
        })
        .with("rename", "rename+modify", async (mode) => {
          // 确保目标目录存在
          await fsp.mkdir(path.dirname(file.fullTargetPath), {recursive: true});

          await fsp.rename(file.fullSourcePath, file.fullTargetPath);
          const log_cwd = process.cwd();
          const log_targetPath = path.relative(log_cwd, file.fullTargetPath);

          if (mode.includes("modify")) {
            // 修改目标文件
            await writeFile(file.fullTargetPath);
            logger.success(`Successfully renamed and updated file: ${logger.file(file.filePath)} => ${logger.file(log_targetPath)}`);
          } else {
            logger.success(`Successfully renamed file: ${logger.file(file.filePath)} => ${logger.file(log_targetPath)}`);
          }
        })
        .exhaustive();
    } catch (error) {
      logger.error(`Failed to ${file.mode} file ${logger.file(file.filePath)}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

/**
 * 提示用户确认操作。
 */
async function confirmAction<T extends DiffFile>(filesToUpdate: T[], options: {topMessage?: string | string[]; allowUnsafe?: boolean}): Promise<T[]> {
  if (filesToUpdate.length === 0) {
    return [];
  }

  console.log("\n-----------------------------------------");
  type $1 = typeof prompts.checkbox;
  type $2 = $1 extends (a1: infer T, ...rest: any[]) => any ? T : never;
  type $3 = $2 extends {choices: infer T} ? T : never;
  type $4 = $3 extends readonly (infer T)[] ? T : never;
  const choices: $4[] = [];
  let currentFrom = "";
  for (const file of filesToUpdate) {
    if (file.from !== currentFrom) {
      choices.push(new prompts.Separator((currentFrom = file.from)));
    }
    choices.push({
      name: [
        //
        logger.mode(file.mode) + (file.safe ? "" : "⚠️"),
        logger.file(file.filePath),
      ].join("\t"),

      value: file.filePath,
      checked: file.safe || options.allowUnsafe,
    });
  }
  const selectedFiles = await prompts.checkbox({
    message: iter_map_not_null([options.topMessage, "The following files will be overwritten:\n"].flat()).join("\n"),
    choices: choices as $3,
    pageSize: process.stdout.rows || filesToUpdate.length,
  });
  console.log("-----------------------------------------");
  return filesToUpdate.filter((file) => selectedFiles.includes(file.filePath));
}

interface ApplyAiResponseOptions {
  yes?: boolean; // 是否跳过确认提示
  cwd?: string; // 工作目录
  unsafe?: boolean; // 是否允许不安全的文件操作
  format?: boolean; // 是否格式化代码
  gitCommit?: boolean; // 是否自信 Git 提交
}
/**
 * 主执行函数。
 */
export async function applyAiResponse(markdownFilePaths: string[] | string, {yes, cwd = process.cwd(), unsafe, format, gitCommit}: ApplyAiResponseOptions = {}) {
  if (typeof markdownFilePaths === "string") {
    markdownFilePaths = [markdownFilePaths];
  }
  if (markdownFilePaths.length === 0) {
    logger.error("Usage: pnpm apply-ai-response <path_to_markdown_file>, ...<more_markdown_files>");
    process.exit(1);
  }

  const absolutePaths = [
    ...new Set(
      markdownFilePaths
        .map((f) => {
          if (isDynamicPattern(f)) {
            return globbySync(f, {cwd: cwd});
          }
          let absolutePath = path.resolve(cwd, f);

          // 尝试自动补全 .md 文件后缀
          if (!fs.existsSync(absolutePath) && !absolutePath.endsWith(".md")) {
            if (fs.existsSync(absolutePath + ".md")) {
              absolutePath += ".md";
            }
          }
          return absolutePath;
        })
        .flat(),
    ),
  ];

  const rootResolver = createResolver(cwd);

  try {
    logger.info(
      `Reading changes from: ${
        absolutePaths.length === 1
          ? // one file
            logger.file(absolutePaths[0])
          : // multi files
            ["", ...absolutePaths.map((p) => logger.file(p))].join("\n\t-")
      }`,
    );
    const parseMarkdowns = async (filepaths: string[]) => {
      let gitCommitMessage: GitCommitMessage | null = null;
      const diffFiles: DiffFiles = [];
      for (const filepath of filepaths) {
        let markdownContent = await fsp.readFile(filepath, "utf-8");
        if (format) {
          /// 对整个md文件做格式化，目的是为了修复md格式错误的可能。后续代码还是要格式化，因为可能存在插件
          markdownContent = await formatCode(markdownContent, {filepath, prettierParser: "markdown"});
        }
        const aiResponse = await parseMarkdown(filepath, markdownContent, rootResolver);
        gitCommitMessage ??= aiResponse.gitCommitMessage;
        diffFiles.push(...aiResponse.diffFiles);
      }
      return {gitCommitMessage, diffFiles};
    };
    const aiResponse = await parseMarkdowns(absolutePaths);
    const {gitCommitMessage} = aiResponse;

    let filesToUpdate = aiResponse.diffFiles;
    if (filesToUpdate.length > 0) {
      filesToUpdate = yes
        ? filesToUpdate.filter((f) => f.safe || unsafe)
        : await confirmAction(filesToUpdate, {
            topMessage: gitCommitMessage
              ? [
                  // render md to terminal
                  underline(bold(gitCommitMessage.title)),
                  "",
                  gitCommitMessage.detail
                    // simple format
                    .replace(/\*\*(.+?)\*\*/g, (_, v) => bold(v))
                    .replace(/__(.+?)__/g, (_, v) => italic(v))
                    .replace(/`(.+?)`/g, (_, v) => yellow(v)),
                  "_".repeat(process.stdout.columns || 40),
                  "",
                ]
              : undefined,
            allowUnsafe: unsafe,
          });

      if (filesToUpdate.length > 0) {
        logger.info("Applying changes...");
        await applyChanges(filesToUpdate, format);
        logger.success("All changes have been applied successfully!");
      } else {
        logger.info("Operation cancelled by user.");
      }
    }
    if (filesToUpdate.length > 0 && gitCommit) {
      if (gitCommitMessage == null) {
        logger.warn("No Git commit message provided. Skipping commit.");
      } else {
        const git = simpleGit(cwd);
        const changedFiles = [...new Set(filesToUpdate.map((f) => [f.fullSourcePath, f.fullTargetPath]).flat())];
        await git.add(changedFiles);
        const commitRes = await git.commit(
          gitCommitMessage.all,
          // 源文件和目标文件都提交了
          changedFiles,
        );

        logger.success(`Changes committed successfully! ${blue(commitRes.commit)}`);
      }
    }
    return filesToUpdate;
  } catch (error) {
    logger.error(`An error occurred: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

if (import_meta_ponyfill(import.meta).main) {
  const args = parseArgs(process.argv.slice(2), {
    boolean: ["format", "yes", "gitCommit"],
    string: ["cwd"],
    alias: {
      G: "gitCommit",
      F: "format",
      Y: "yes",
      C: "cwd",
    },
    default: {
      format: true,
    },
  });

  // 运行主函数
  await applyAiResponse(
    args._.map((v) => v.toString()),
    args,
  );
}
