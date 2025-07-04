process.removeAllListeners("warning");

import {$, createResolver, cyan, green, magenta, normalizeFilePath, prompts, red, yellow, type PathResolver} from "@gaubee/nodekit";
import {iter_map_not_null} from "@gaubee/util";
import {parseArgs} from "@std/cli/parse-args";
import {import_meta_ponyfill} from "import-meta-ponyfill";
import fs from "node:fs";
import path from "node:path";
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

type DiffFileMode = "add" | "delete" | "modify" | "rename" | "rename+modify";
type DiffFiles = Array<{
  filePath: string;
  code: string;
  fullSourcePath: string;
  fullTargetPath: string;
  mode: DiffFileMode;
  safe: boolean;
}>;

/**
 * 解析包含多个文件代码块的 Markdown 文本。
 * @param markdownContent - 从文件中读取的 Markdown 全文。
 * @returns 一个包含文件路径和代码内容的对象数组。
 */
function parseMarkdown(markdownContent: string, rootResolver: PathResolver): DiffFiles {
  // 正则表达式，用于匹配文件路径标题和对应的代码块
  // 匹配 `#### ` 开头，后面跟着路径，直到换行符
  // 然后非贪婪地匹配 ` ``` ` 代码块之间的所有内容
  const fileBlockRegex = /\#{4}[\s\*]+`(.+?)`[\s\S]*?\n`{3,4}[\w]*\s*\n([\s\S]*?)\n`{3,4}/g;
  const matches: DiffFiles = [];

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
      fullTargetPath = rootResolver(code.replace("$$RENAME_FILE$$", ""));
      code = code.slice(code.indexOf("\n") + 1);
      if (code.length > 0) {
        mode = "rename+modify";
      } else {
        mode = "rename";
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

    matches.push({filePath, code, fullSourcePath, fullTargetPath, mode, safe});
  }

  if (matches.length === 0) {
    logger.warn("No valid file blocks found in the Markdown content.");
  } else {
    logger.success(`Found ${matches.length} file blocks to process.`);
  }

  return matches;
}

/**
 * 将解析出的代码内容安全地写入到本地文件系统。
 * @param files - 从 Markdown 解析出的文件对象数组。
 */
async function applyChanges(files: DiffFiles): Promise<void> {
  for (const file of files) {
    const writeFile = async (filepath = file.fullSourcePath, filecode: string = file.code) => {
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
          const cwd = process.cwd();
          const targetPath = path.relative(cwd, file.fullTargetPath);

          if (mode.includes("modify")) {
            // 写入文件
            await writeFile();
            logger.success(`Successfully renamed and updated file: ${logger.file(file.filePath)} => ${logger.file(targetPath)}`);
          } else {
            logger.success(`Successfully renamed file: ${logger.file(file.filePath)} => ${logger.file(targetPath)}`);
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
async function confirmAction(filesToUpdate: DiffFiles, allowUnsafe?: boolean): Promise<DiffFiles> {
  if (filesToUpdate.length === 0) {
    return [];
  }

  console.log("\n-----------------------------------------");
  const selectedFiles = await prompts.checkbox({
    message: "The following files will be overwritten:",
    choices: filesToUpdate.map((file) => ({
      name: [
        //
        logger.mode(file.mode) + (file.safe ? "" : "⚠️"),
        logger.file(file.filePath),
      ].join("\t"),

      value: file.filePath,
      checked: file.safe || allowUnsafe,
    })),
    pageSize: process.stdout.rows || filesToUpdate.length,
  });
  console.log("-----------------------------------------");
  return filesToUpdate.filter((file) => selectedFiles.includes(file.filePath));
}

interface ApplyAiResponseOptions {
  yes?: boolean; // 是否跳过确认提示
  cwd?: string; // 工作目录
  unsafe?: boolean; // 是否允许不安全的文件操作
}
/**
 * 主执行函数。
 */
export async function applyAiResponse(markdownFilePath?: string, {yes, cwd = process.cwd(), unsafe}: ApplyAiResponseOptions = {}) {
  if (!markdownFilePath) {
    logger.error("Usage: pnpm apply-ai-response <path_to_markdown_file>");
    process.exit(1);
  }

  let absolutePath = path.resolve(markdownFilePath);
  // 尝试自动补全 .md 文件后缀
  if (!fs.existsSync(absolutePath) && !absolutePath.endsWith(".md")) {
    if (fs.existsSync(absolutePath + ".md")) {
      absolutePath += ".md";
    }
  }

  const rootResolver = createResolver(cwd);

  try {
    logger.info(`Reading changes from: ${logger.file(absolutePath)}`);
    const markdownContent = await fsp.readFile(absolutePath, "utf-8");
    let filesToUpdate = parseMarkdown(markdownContent, rootResolver);

    if (filesToUpdate.length > 0) {
      filesToUpdate = yes ? filesToUpdate.filter((f) => f.safe || unsafe) : await confirmAction(filesToUpdate, unsafe);
      if (filesToUpdate.length > 0) {
        logger.info("Applying changes...");
        await applyChanges(filesToUpdate);
        logger.success("All changes have been applied successfully!");
      } else {
        logger.info("Operation cancelled by user.");
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
    boolean: ["format", "yes"],
    string: ["cwd"],
    alias: {
      F: "format",
      Y: "yes",
      C: "cwd",
    },
  });

  const markdownFilePath = args._.map((v) => v.toString()).shift();
  // 运行主函数
  const filesToUpdate = await applyAiResponse(markdownFilePath, args);

  if (args.format && filesToUpdate.length > 0) {
    console.log(cyan("----Format----"));
    await $`pnpm prettier --experimental-cli --write ${iter_map_not_null(filesToUpdate, (f) => {
      if (f.mode === "delete") {
        return;
      }
      return f.fullSourcePath;
    })}`;
  }
}
