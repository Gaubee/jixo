import {normalizeFilePath, type PathResolver} from "@gaubee/nodekit";
import fs from "node:fs";
import {logger} from "./logger.js";

export type DiffFileMode = "add" | "delete" | "modify" | "rename" | "rename+modify";

export interface DiffFile {
  from: string;
  filePath: string;
  code: string;
  fullSourcePath: string;
  fullTargetPath: string;
  mode: DiffFileMode;
  safe: boolean;
}

export type DiffFiles = Array<DiffFile>;

export interface GitCommitMessage {
  title: string;
  detail: string;
  all: string;
}

export interface AiResponse {
  fromFilepath: string;
  gitCommitMessage: GitCommitMessage | null;
  diffFiles: DiffFiles;
}

/**
 * 解析包含多个文件代码块的 Markdown 文本。
 * @param from - The markdown file path.
 * @param markdownContent - The full markdown content read from the file.
 * @param rootResolver - A path resolver to resolve file paths relative to the project root.
 * @returns An object containing the git commit message and a list of file diffs.
 */
export function parseMarkdown(from: string, markdownContent: string, rootResolver: PathResolver): AiResponse {
  const gitCommitMessageRegex = /【变更日志】[*\s\n]+(`{3,})[\w]*\s*\n([\s\S]*?)\n\1/;
  const gitCommitMessageMatchRes = markdownContent.match(gitCommitMessageRegex);
  let gitCommitMessage: GitCommitMessage | null = null;
  if (gitCommitMessageMatchRes) {
    const gitCommitMessageContent = gitCommitMessageMatchRes[2].trim();
    const [title, ...detailLines] = gitCommitMessageContent.split("\n");
    const detail = detailLines.join("\n").trim();
    gitCommitMessage = {
      title: title.trim(),
      detail: detail,
      all: `${title.trim()}\n\n${detail}\n`,
    };
  }

  // Regex to match file path headers and their corresponding code blocks
  // It handles ``` and ```` fences.
  const fileBlockRegex = /#{4}[\s*]+`(.+?)`[\s\S]*?\n(`{3,6})[\w]*\s*\n([\s\S]*?)\n\2/g;
  const diffFiles: DiffFiles = [];

  logger.info("Parsing Markdown content to find file blocks...");

  for (const match of markdownContent.matchAll(fileBlockRegex)) {
    const filePath = match[1].trim();
    let code = match[3].trim();
    const fullSourcePath = rootResolver(filePath);
    let fullTargetPath = fullSourcePath;
    let mode: DiffFileMode | undefined;

    if (code.startsWith("$$DELETE_FILE$$")) {
      mode = "delete";
    } else if (code.startsWith("$$RENAME_FILE$$")) {
      const firstLineIndex = code.indexOf("\n");
      if (firstLineIndex !== -1) {
        mode = "rename+modify";
        fullTargetPath = rootResolver(code.slice(0, firstLineIndex).replace("$$RENAME_FILE$$", "").trim());
        code = code.slice(firstLineIndex + 1);
      } else {
        mode = "rename";
        fullTargetPath = rootResolver(code.replace("$$RENAME_FILE$$", "").trim());
        code = "";
      }
    } else if (fs.existsSync(fullSourcePath)) {
      mode = "modify";
    } else {
      mode = "add";
    }

    if (mode == null) {
      logger.error(`Invalid parse mode for filepath: ${filePath}`);
      continue;
    }

    // Security check: ensure the target path is within the project root
    const safe = normalizeFilePath(fullSourcePath).startsWith(normalizeFilePath(rootResolver.dirname) + "/");

    diffFiles.push({from, filePath, code, fullSourcePath, fullTargetPath, mode, safe});
  }

  if (diffFiles.length === 0) {
    logger.warn("No valid file blocks found in the Markdown content.");
  } else {
    logger.success(`Found ${diffFiles.length} file blocks to process.`);
  }

  return {fromFilepath: from, gitCommitMessage, diffFiles};
}
