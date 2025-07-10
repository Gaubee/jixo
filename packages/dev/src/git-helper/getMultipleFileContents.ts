import {spawn} from "child_process";

/**
 * 定义返回结果中每个文件对象的结构。
 */
export interface FileContentResult {
  /** 文件的仓库相对路径 */
  path: string;
  /** 文件内容的字符串形式。如果文件未找到或发生错误，则为 null。 */
  content: string | null;
  /** 如果有错误，则包含错误信息。 */
  error?: string;
}

/**
 * 使用 `git cat-file --batch` 一次性高效地获取多个文件的完整内容。
 * 这是为脚本设计的最高效的 Git 底层命令之一。
 *
 * @param repoPath git 仓库的绝对或相对路径。
 * @param commitRef 要从中读取文件的 commit 引用 (例如 'HEAD', 'main', 或一个 commit hash)。
 * @param filePaths 一个包含文件路径的数组，路径相对于仓库根目录。
 * @returns 一个 Promise，它解析为一个包含文件内容结果的数组。
 */
export async function getMultipleFileContents(repoPath: string, commitRef: string, filePaths: string[]): Promise<FileContentResult[]> {
  // 如果没有文件需要获取，直接返回空数组
  if (filePaths.length === 0) {
    return [];
  }

  return new Promise((resolve, reject) => {
    // 初始化结果映射，每个文件都先标记为未处理
    const results = new Map<string, FileContentResult>();
    filePaths.forEach((path) => {
      results.set(path, {path, content: null, error: "File was not processed."});
    });

    // 创建一个队列，存放我们期望能收到其内容的文件的路径。
    // 当 git 报告某个文件 "missing" 时，我们会从这个队列中移除它。
    const expectedContentQueue = [...filePaths];

    // 启动 git cat-file 进程
    const gitProcess = spawn("git", ["-C", repoPath, "cat-file", "--batch"]);

    // 使用 Buffer 来安全地处理二进制数据
    let stdoutBuffer = Buffer.alloc(0);

    // 处理标准输出流
    gitProcess.stdout.on("data", (chunk: Buffer) => {
      stdoutBuffer = Buffer.concat([stdoutBuffer, chunk]);

      // 持续解析缓冲区，直到无法再解析出完整的记录
      while (true) {
        // 查找第一个换行符以分割出头部信息
        const newlineIndex = stdoutBuffer.indexOf("\n");
        if (newlineIndex === -1) {
          // 缓冲区中没有完整的头部信息，等待更多数据
          break;
        }

        const header = stdoutBuffer.toString("utf8", 0, newlineIndex);

        // 检查文件是否 "missing"
        if (header.endsWith(" missing")) {
          const missingRef = header.split(" ")[0];
          // 从 `commitRef:path` 中提取路径
          const missingPath = missingRef.substring(commitRef.length + 1);

          if (results.has(missingPath)) {
            results.get(missingPath)!.error = "File not found in the specified commit.";
          }

          // 从期望队列中移除这个找不到的文件
          const index = expectedContentQueue.indexOf(missingPath);
          if (index > -1) {
            expectedContentQueue.splice(index, 1);
          }

          // 从缓冲区移除已处理的 "missing" 行
          stdoutBuffer = stdoutBuffer.slice(newlineIndex + 1);
          continue; // 继续解析缓冲区的下一部分
        }

        // 解析正常的头部信息: <hash> <type> <size>
        const [hash, type, sizeStr] = header.split(" ");
        const size = parseInt(sizeStr, 10);

        if (isNaN(size)) {
          // 解析失败，头部格式不正确，可能缓冲区不完整
          break;
        }

        // 检查是否有足够的数据来读取整个文件内容
        // 包括头部、一个换行符、内容本身和末尾的换行符
        const recordLength = newlineIndex + 1 + size + 1;
        if (stdoutBuffer.length < recordLength) {
          // 缓冲区数据不足，等待更多数据
          break;
        }

        // 提取文件内容
        const contentBuffer = stdoutBuffer.slice(newlineIndex + 1, newlineIndex + 1 + size);

        // 从期望队列中取出第一个文件路径，我们假设 Git 按顺序返回内容
        const currentPath = expectedContentQueue.shift();

        if (currentPath && results.has(currentPath)) {
          const result = results.get(currentPath)!;
          result.content = contentBuffer.toString("utf8");
          result.error = undefined; // 清除错误信息
        }

        // 从缓冲区移除已处理的完整记录
        stdoutBuffer = stdoutBuffer.slice(recordLength);
      }
    });

    // 监听进程错误
    gitProcess.on("error", (err) => {
      reject(new Error(`Failed to start git process: ${err.message}`));
    });

    // 监听标准错误流
    gitProcess.stderr.on("data", (data) => {
      console.error(`git cat-file stderr: ${data.toString()}`);
    });

    // 监听进程关闭事件
    gitProcess.on("close", (code) => {
      if (code !== 0 && filePaths.length > 0 && Array.from(results.values()).every((r) => r.content === null)) {
        // 如果进程以非零代码退出，并且没有任何文件成功处理，则拒绝 Promise
        reject(new Error(`git cat-file process exited with code ${code}`));
      } else {
        // 否则，解析成功，返回结果
        resolve(Array.from(results.values()));
      }
    });

    // 向 git 进程的 stdin 写入所有需要查询的文件
    for (const filePath of filePaths) {
      gitProcess.stdin.write(`${commitRef}:${filePath}\n`);
    }
    // 关闭 stdin，告知 git 我们已经发送完所有请求
    gitProcess.stdin.end();
  });
}

// --- 示例用法 (可以放在另一个文件中，例如 main.ts) ---
/*
import { getMultipleFileContents } from './getMultipleFileContents';
import path from 'path';

(async () => {
  try {
    const repoPath = path.resolve(__dirname, '../test-repo'); // 你的仓库路径
    const targetCommit = 'HEAD';
    const filesToGet = ['file1.txt', 'feature.txt', 'non-existent-file.txt'];

    console.log(`Getting contents for multiple files at commit ${targetCommit}`);
    console.log('---');

    const contents = await getMultipleFileContents(repoPath, targetCommit, filesToGet);

    for (const result of contents) {
      console.log(`File: ${result.path}`);
      if (result.error) {
        console.log(`  Error: ${result.error}`);
      } else {
        console.log('  Content:');
        console.log(`  > ${result.content?.replace(/\n/g, '\n  > ')}`);
      }
      console.log('---');
    }
  } catch (error) {
    console.error('An unexpected error occurred in the main execution:', error);
  }
})();
*/
