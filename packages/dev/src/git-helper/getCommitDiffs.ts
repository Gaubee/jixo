import {spawn} from "child_process";
import { randomUUID } from "crypto";

/**
 * 定义提交的元数据结构。
 */
export interface CommitDetails {
  hash: string;
  authorName: string;
  authorEmail: string;
  /** 作者提交时间的 Unix 时间戳 (秒) */
  timestamp: number;
  subject: string;
}

/**
 * 文件变更状态的类型。
 * A: Added, M: Modified, D: Deleted, R: Renamed, T: Type Changed
 */
export type FileChangeStatus = "A" | "M" | "D" | "R" | "T";

/**
 * 定义单个文件 diff 的结构。
 */
export interface FileDiff {
  /** 文件的仓库相对路径 */
  path: string;
  /** 文件变更状态 */
  status: FileChangeStatus;
  /** 完整的 diff 内容 */
  diff: string;
}

/**
 * 定义整个函数返回的结构化对象。
 */
export interface ParsedCommitResult {
  details: CommitDetails;
  files: FileDiff[];
}

/**

 * 使用一次 `git show` 调用，高效地获取某次提交的元数据和指定文件（或所有文件）的 diff 内容。
 *
 * @param repoPath git 仓库的绝对或相对路径。
 * @param commitRef 要查询的 commit 引用 (例如 'HEAD', 'main', 或一个 commit hash)。
 * @param filePaths (可选) 一个文件路径数组。如果提供，则只获取这些文件的 diff；否则获取该次提交中所有文件的 diff。
 * @returns 一个 Promise，它解析为一个包含提交详情和文件 diff 列表的结构化对象。
 */
export async function getCommitDiffs(repoPath: string, commitRef: string, filePaths?: string[]): Promise<ParsedCommitResult> {
  return new Promise((resolve, reject) => {
    // 定义独特的、不可能在 commit 信息或 diff 中出现的分隔符
    const COMMIT_INFO_START = `_--COMMIT_INFO_${randomUUID()}_START--_`;
    const COMMIT_INFO_END = `_--COMMIT_INFO_${randomUUID()}_END--_`;

    const prettyFormat = [COMMIT_INFO_START, "%H", "%aN", "%aE", "%at", "%s", COMMIT_INFO_END].join("%x00");

    // *** MODIFICATION HERE ***
    // 动态构建 git 命令的参数
    const args = ["-C", repoPath, "show", `--pretty=format:${prettyFormat}`, commitRef];

    // 如果提供了文件列表，则将其添加到参数中
    if (filePaths && filePaths.length > 0) {
      args.push("--", ...filePaths);
    }

    // 启动 git show 进程
    const gitProcess = spawn("git", args);

    let stdoutData = "";
    let stderrData = "";

    gitProcess.stdout.on("data", (chunk) => (stdoutData += chunk.toString()));
    gitProcess.stderr.on("data", (chunk) => (stderrData += chunk.toString()));
    gitProcess.on("error", reject);

    gitProcess.on("close", (code) => {
      // code 128 是 git 找不到 commitRef 时的常见错误码，也视为错误
      if (code !== 0) {
        return reject(new Error(`git show process exited with code ${code}: ${stderrData}`));
      }

      // --- 解析逻辑保持不变 ---

      const infoStartIndex = stdoutData.indexOf(COMMIT_INFO_START);
      const infoEndIndex = stdoutData.indexOf(COMMIT_INFO_END);

      if (infoStartIndex === -1 || infoEndIndex === -1) {
        return reject(new Error("Could not find commit info delimiters in git output."));
      }

      const infoStr = stdoutData.substring(infoStartIndex + COMMIT_INFO_START.length, infoEndIndex);
      const diffsStr = stdoutData.substring(infoEndIndex + COMMIT_INFO_END.length).trim();

      const [hash, authorName, authorEmail, timestampStr, subject] = infoStr.split("\x00");
      const details: CommitDetails = {
        hash,
        authorName,
        authorEmail,
        timestamp: parseInt(timestampStr, 10),
        subject,
      };

      const files: FileDiff[] = [];
      if (diffsStr) {
        const diffChunks = diffsStr.split("\ndiff --git ");

        for (const chunk of diffChunks.filter((c) => c.trim())) {
          const fullDiff = "diff --git " + chunk;
          const lines = chunk.split("\n");
          const firstLine = lines[0];
          const secondLine = lines[1] || "";

          let status: FileChangeStatus = "M";
          if (secondLine.startsWith("new file mode")) status = "A";
          else if (secondLine.startsWith("deleted file mode")) status = "D";
          else if (secondLine.startsWith("rename from")) status = "R";

          const pathMatch = firstLine.match(/b\/(.+)/);
          const filePath = pathMatch ? pathMatch[1].trim() : "Unknown file";

          files.push({path: filePath, status, diff: fullDiff});
        }
      }

      resolve({details, files});
    });
  });
}
