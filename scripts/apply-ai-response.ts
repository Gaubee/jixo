import {createResolverByRootFile, cyan, green, magenta, normalizeFilePath, red, yellow} from "@gaubee/nodekit";
import fs from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";
const rootResolver = createResolverByRootFile(import.meta.url);
const rootDirname = normalizeFilePath(rootResolver.dirname) + "/";

// --- 配置项 ---
const ALLOW_OVERWRITE = true; // 设置为 true 以允许覆盖现有文件

// --- 日志记录器 ---
const logger = {
  info: (message: string) => console.log(cyan("[INFO]"), message),
  success: (message: string) => console.log(green("[SUCCESS]"), message),
  warn: (message: string) => console.log(yellow("[WARN]"), message),
  error: (message: string) => console.error(red("[ERROR]"), message),
  file: (filePath: string) => magenta(filePath),
};

/**
 * 解析包含多个文件代码块的 Markdown 文本。
 * @param markdownContent - 从文件中读取的 Markdown 全文。
 * @returns 一个包含文件路径和代码内容的对象数组。
 */
function parseMarkdown(markdownContent: string): {filePath: string; code: string}[] {
  // 正则表达式，用于匹配文件路径标题和对应的代码块
  // 匹配 `#### ` 开头，后面跟着路径，直到换行符
  // 然后非贪婪地匹配 ` ``` ` 代码块之间的所有内容
  const fileBlockRegex = /\#{4}[\s\*]+`(.+?)`[\s\S]*?\n`{3,4}(?:ts|typescript|json|md|bash|sh)\s*\n([\s\S]*?)\n`{3,4}/g;
  const matches: Array<{filePath; code}> = [];
  let match;

  logger.info("Parsing Markdown content to find file blocks...");

  while ((match = fileBlockRegex.exec(markdownContent)) !== null) {
    const filePath = match[1].trim();
    const code = match[2].trim();
    matches.push({filePath, code});
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
async function applyChanges(files: {filePath: string; code: string}[]): Promise<void> {
  for (const file of files) {
    const targetPath = rootResolver(file.filePath);

    // --- 安全检查 ---
    // 确保目标路径在项目根目录内，防止路径遍历攻击
    if (!targetPath.startsWith(rootDirname)) {
      logger.error(`Skipping unsafe file path: ${logger.file(file.filePath)}. It resolves outside the project root.`);
      continue;
    }

    try {
      // 确保目标目录存在
      const dirName = path.dirname(targetPath);
      await fs.mkdir(dirName, {recursive: true});

      // 写入文件
      if (ALLOW_OVERWRITE) {
        await fs.writeFile(targetPath, file.code + "\n", "utf-8"); // 添加一个换行符以符合惯例
        logger.success(`Successfully updated file: ${logger.file(file.filePath)}`);
      } else {
        logger.warn(`Skipping file (overwrite disabled): ${logger.file(file.filePath)}`);
      }
    } catch (error) {
      logger.error(`Failed to write file ${logger.file(file.filePath)}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

/**
 * 提示用户确认操作。
 */
async function confirmAction(filesToUpdate: {filePath: string; code: string}[]): Promise<boolean> {
  if (filesToUpdate.length === 0) {
    return false;
  }

  console.log("\n-----------------------------------------");
  logger.info("The following files will be overwritten:");
  filesToUpdate.forEach((file) => console.log(`  - ${logger.file(file.filePath)}`));
  console.log("-----------------------------------------");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`\nAre you sure you want to apply these ${filesToUpdate.length} changes? (y/N) `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "y");
    });
  });
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
    const markdownContent = await fs.readFile(absolutePath, "utf-8");
    const filesToUpdate = parseMarkdown(markdownContent);

    if (filesToUpdate.length > 0) {
      const userConfirmed = await confirmAction(filesToUpdate);
      if (userConfirmed) {
        logger.info("Applying changes...");
        await applyChanges(filesToUpdate);
        logger.success("All changes have been applied successfully!");
      } else {
        logger.info("Operation cancelled by user.");
      }
    }
  } catch (error) {
    logger.error(`An error occurred: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

// 运行主函数
main();
