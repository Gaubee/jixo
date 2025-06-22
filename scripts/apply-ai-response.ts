import {$, createResolverByRootFile, cyan, green, magenta, normalizeFilePath, prompts, red, yellow} from "@gaubee/nodekit";
import {iter_map_not_null} from "@gaubee/util";
import fs from "node:fs";
import path from "node:path";
import {match} from "ts-pattern";
const fsp = fs.promises;
const rootResolver = createResolverByRootFile(import.meta.url);
const rootDirname = normalizeFilePath(rootResolver.dirname) + "/";

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
      .with("modify", () => yellow("♻️"))
      .with("delete", () => red("❌"))
      .exhaustive(),
};

type DiffFileMode = "add" | "delete" | "modify";
type DiffFiles = Array<{
  filePath: string;
  code: string;
  fullFilepath: string;
  mode: DiffFileMode;
  safe: boolean;
}>;

/**
 * 解析包含多个文件代码块的 Markdown 文本。
 * @param markdownContent - 从文件中读取的 Markdown 全文。
 * @returns 一个包含文件路径和代码内容的对象数组。
 */
function parseMarkdown(markdownContent: string): DiffFiles {
  // 正则表达式，用于匹配文件路径标题和对应的代码块
  // 匹配 `#### ` 开头，后面跟着路径，直到换行符
  // 然后非贪婪地匹配 ` ``` ` 代码块之间的所有内容
  const fileBlockRegex = /\#{4}[\s\*]+`(.+?)`[\s\S]*?\n`{3,4}[\w]*\s*\n([\s\S]*?)\n`{3,4}/g;
  const matches: DiffFiles = [];

  logger.info("Parsing Markdown content to find file blocks...");

  for (const match of markdownContent.matchAll(fileBlockRegex)) {
    const filePath = match[1].trim();
    const code = match[2].trim();
    const fullFilepath = rootResolver(filePath);
    let mode: DiffFileMode = "modify";
    if (code === "$$DELETE_FILE$$") {
      mode = "delete";
    } else if (!fs.existsSync(fullFilepath)) {
      mode = "add";
    }
    // --- 安全检查 ---
    // 确保目标路径在项目根目录内，防止路径遍历攻击
    let safe = fullFilepath.startsWith(rootDirname);
    // if (!safe) {
    //   logger.error(`unsafe file path: ${logger.file(filePath)}.`);
    // }

    matches.push({filePath, code, fullFilepath, mode, safe});
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
    try {
      if (file.mode === "delete") {
        await fsp.rm(file.fullFilepath, {recursive: true, force: true});
        logger.success(`Successfully deleted file: ${logger.file(file.filePath)}`);
      } else {
        // 确保目标目录存在
        const dirName = path.dirname(file.fullFilepath);
        await fsp.mkdir(dirName, {recursive: true});

        // 写入文件
        await fsp.writeFile(file.fullFilepath, file.code + "\n", "utf-8"); // 添加一个换行符以符合惯例
        logger.success(`Successfully ${file.mode === "add" ? "writed" : "updated"} file: ${logger.file(file.filePath)}`);
      }
    } catch (error) {
      logger.error(`Failed to ${file.mode} file ${logger.file(file.filePath)}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

/**
 * 提示用户确认操作。
 */
async function confirmAction(filesToUpdate: DiffFiles): Promise<DiffFiles> {
  if (filesToUpdate.length === 0) {
    return [];
  }

  console.log("\n-----------------------------------------");
  const selectedFiles = await prompts.checkbox({
    message: "The following files will be overwritten:",
    choices: filesToUpdate.map((file) => ({
      name: logger.mode(file.mode) + "  " + logger.file(file.filePath),
      value: file.filePath,
      checked: file.safe,
    })),
    pageSize: process.stdout.rows || filesToUpdate.length,
  });
  console.log("-----------------------------------------");
  return filesToUpdate.filter((file) => selectedFiles.includes(file.filePath));
}

/**
 * 主执行函数。
 */
async function main() {
  const markdownFilePath = process.argv[2];
  if (!markdownFilePath) {
    logger.error("Usage: pnpm apply-ai-response <path_to_markdown_file>");
    process.exit(1);
  }

  const absolutePath = path.resolve(markdownFilePath);

  try {
    logger.info(`Reading changes from: ${logger.file(absolutePath)}`);
    const markdownContent = await fsp.readFile(absolutePath, "utf-8");
    let filesToUpdate = parseMarkdown(markdownContent);

    if (filesToUpdate.length > 0) {
      filesToUpdate = await confirmAction(filesToUpdate);
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

// 运行主函数
const filesToUpdate = await main();

console.log(cyan("----Format----"));
await $`pnpm prettier --write ${iter_map_not_null(filesToUpdate, (f) => {
  if (f.mode === "delete") {
    return;
  }
  return f.fullFilepath;
})}`;
