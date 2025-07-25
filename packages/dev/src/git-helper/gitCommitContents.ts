import {spawn} from "node:child_process";
import type {GitFileContentResult} from "./types.js";

/**
 * 使用 `git cat-file --batch` 一次性高效地获取多个文件的完整内容。
 * 这是为脚本设计的最高效的 Git 底层命令之一。
 *
 * @param repoPath git 仓库的绝对或相对路径。
 * @param commitRef 要从中读取文件的 commit 引用 (例如 'HEAD', 'main', 或一个 commit hash)。
 * @param filePaths 一个包含文件路径的数组，路径相对于仓库根目录。
 * @returns 一个 Promise，它解析为一个包含文件内容结果的数组。
 */
export async function gitCommitContents(repoPath: string, commitRef: string, filePaths: string[]): Promise<GitFileContentResult[]> {
  if (filePaths.length === 0) {
    return [];
  }

  return new Promise((resolve, reject) => {
    // 最终的结果 Map
    const resultsMap = new Map<string, GitFileContentResult>(
      filePaths.map((path) => [path, {path, content: undefined, status: "M"}]), // 默认状态为 'M'
    );

    const gitProcess = spawn("git", ["cat-file", "--batch"], {cwd: repoPath});

    // 准备写入 stdin 的数据
    const requests = filePaths.map((path) => `${commitRef}:${path}\n`).join("");

    let stdoutBuffer = Buffer.alloc(0);
    let stderrOutput = "";

    gitProcess.stdout.on("data", (chunk: Buffer) => {
      stdoutBuffer = Buffer.concat([stdoutBuffer, chunk]);
    });

    gitProcess.stderr.on("data", (chunk) => {
      stderrOutput += chunk.toString();
    });

    gitProcess.on("error", (err) => {
      reject(new Error(`Failed to start 'git cat-file' process: ${err.message}`));
    });

    gitProcess.on("close", (code) => {
      if (code !== 0 && stdoutBuffer.length === 0) {
        return reject(new Error(`'git cat-file' process exited with code ${code}. Stderr: ${stderrOutput}`));
      }

      // 进程关闭后，一次性解析所有收到的数据
      let offset = 0;
      for (const path of filePaths) {
        if (offset >= stdoutBuffer.length) break;

        const newlineIndex = stdoutBuffer.indexOf("\n", offset);
        if (newlineIndex === -1) break;

        const header = stdoutBuffer.toString("utf8", offset, newlineIndex);
        offset = newlineIndex + 1;

        const result = resultsMap.get(path)!;

        if (header.endsWith(" missing")) {
          // 文件未找到，保持 content 为 undefined
          result.status = "D"; // 将其视为已删除或不存在
        } else {
          const [, type, sizeStr] = header.split(" ");
          const size = parseInt(sizeStr, 10);

          if (isNaN(size) || offset + size > stdoutBuffer.length) {
            // 数据不完整或格式错误，跳过
            continue;
          }

          result.content = stdoutBuffer.toString("utf8", offset, offset + size);
          result.status = type === "blob" ? "M" : "T"; // T for Type Changed (e.g., a tree)

          // 移动偏移量，跳过内容和紧随其后的换行符
          offset += size + 1;
        }
      }

      resolve(Array.from(resultsMap.values()));
    });

    // 写入所有请求并关闭 stdin
    gitProcess.stdin.write(requests);
    gitProcess.stdin.end();
  });
}
