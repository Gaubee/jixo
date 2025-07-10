import {spawn} from "child_process";

/**
 * 文件变更状态的类型。
 * A: Added, M: Modified, D: Deleted, R: Renamed, U: Unmerged (冲突)
 */
export type WorkingCopyFileStatus = "A" | "M" | "D" | "R" | "U";

/**
 * 定义单个文件 diff 的结构。
 */
export interface WorkingCopyFileDiff {
  /** 文件的仓库相对路径 */
  path: string;
  /** 文件变更状态 */
  status: WorkingCopyFileStatus;
  /** 完整的 diff 内容 */
  diff: string;
}

/**
 * 使用一次 `git diff` 调用，高效地获取工作区或暂存区中文件的 diff 内容。
 *
 * @param repoPath git 仓库的绝对或相对路径。
 * @param options (可选) 配置对象。
 * @param options.staged (可选) 如果为 true，则获取暂存区(staged)的 diff；否则获取工作区(unstaged)的 diff。默认为 false。
 * @param options.filePaths (可选) 一个文件路径数组。如果提供，则只获取这些文件的 diff。如果省略，则获取所有变更文件的 diff。
 * @returns 一个 Promise，它解析为一个包含文件 diff 信息的数组。
 */
export async function getWorkingCopyDiffs(
  repoPath: string,
  options: {
    staged?: boolean;
    filePaths?: string[];
  } = {},
): Promise<WorkingCopyFileDiff[]> {
  return new Promise((resolve, reject) => {
    // 首先，我们需要获取变更文件的列表及其状态，因为 `git diff` 的输出不直接包含状态信息
    // 使用 `--name-status` 可以高效地做到这一点
    const statusArgs = ["-C", repoPath, "diff", "--name-status"];
    if (options.staged) {
      statusArgs.push("--staged");
    }
    if (options.filePaths && options.filePaths.length > 0) {
      statusArgs.push("--", ...options.filePaths);
    }

    const statusProcess = spawn("git", statusArgs);
    let statusOutput = "";
    statusProcess.stdout.on("data", (chunk) => (statusOutput += chunk.toString()));
    statusProcess.stderr.on("data", (chunk) => console.error(`git diff --name-status stderr: ${chunk}`));
    statusProcess.on("close", (code) => {
      if (code !== 0) {
        return reject(new Error(`git diff --name-status process exited with code ${code}`));
      }

      const fileStatusMap = new Map<string, WorkingCopyFileStatus>();
      const filesToList = statusOutput
        .trim()
        .split("\n")
        .filter((line) => line.trim())
        .map((line) => {
          const [statusChar, filePath] = line.split(/\s+/);
          // R (renamed) 格式是 R100  old_path  new_path，我们只关心 new_path
          const finalPath = statusChar.startsWith("R") ? line.split(/\s+/)[2] : filePath;
          fileStatusMap.set(finalPath, statusChar[0] as WorkingCopyFileStatus);
          return finalPath;
        });

      if (filesToList.length === 0) {
        return resolve([]);
      }

      // 现在，我们有了文件列表和它们的状态，再用一次 `git diff` 获取完整的 diff 内容
      const diffArgs = ["-C", repoPath, "diff"];
      if (options.staged) {
        diffArgs.push("--staged");
      }
      // 传递我们刚刚获取到的文件列表，确保只 diff 这些文件
      diffArgs.push("--", ...filesToList);

      const diffProcess = spawn("git", diffArgs);
      let diffOutput = "";
      diffProcess.stdout.on("data", (chunk) => (diffOutput += chunk.toString()));
      diffProcess.stderr.on("data", (chunk) => console.error(`git diff stderr: ${chunk}`));
      diffProcess.on("close", (diffCode) => {
        if (diffCode !== 0) {
          return reject(new Error(`git diff process exited with code ${diffCode}`));
        }

        const diffs: WorkingCopyFileDiff[] = [];
        const diffChunks = diffOutput.trim().split("\ndiff --git ");

        for (const chunk of diffChunks.filter((c) => c.trim())) {
          const fullDiff = chunk.startsWith("diff --git ") ? chunk : "diff --git " + chunk;

          const firstLine = chunk.substring(0, chunk.indexOf("\n"));
          const pathMatch = firstLine.match(/b\/(.+)/);
          const path = pathMatch ? pathMatch[1].trim() : "Unknown";

          const status = fileStatusMap.get(path) || "M"; // 默认是 'M'

          diffs.push({
            path,
            status,
            diff: fullDiff,
          });
        }
        resolve(diffs);
      });
    });
  });
}

// --- 示例用法 ---
/*
import { getWorkingCopyDiffs } from './getWorkingCopyDiffs';
import path from 'path';
import fs from 'fs';

async function setupAndRun() {
  const repoPath = path.resolve(__dirname, '../test-repo-working-copy');
  
  // 创建一个干净的测试环境
  if (fs.existsSync(repoPath)) fs.rmSync(repoPath, { recursive: true, force: true });
  fs.mkdirSync(repoPath);
  spawn('git', ['init'], { cwd: repoPath }).on('close', () => {
    fs.writeFileSync(path.join(repoPath, 'file1.txt'), 'line 1\n');
    fs.writeFileSync(path.join(repoPath, 'file2.txt'), 'hello\n');
    spawn('git', ['add', '.'], { cwd: repoPath }).on('close', () => {
      spawn('git', ['commit', '-m', 'initial'], { cwd: repoPath }).on('close', async () => {
        
        // 制造变更
        fs.appendFileSync(path.join(repoPath, 'file1.txt'), 'line 2\n'); // 未暂存的修改
        fs.writeFileSync(path.join(repoPath, 'file3.txt'), 'new file\n'); // 未暂存的新增
        fs.writeFileSync(path.join(repoPath, 'file4.txt'), 'staged new\n'); // 暂存的新增
        spawn('git', ['add', 'file4.txt'], { cwd: repoPath }).on('close', async () => {
            
          console.log('--- 1. Getting UNSTAGED diffs (all) ---');
          const unstagedDiffs = await getWorkingCopyDiffs(repoPath);
          unstagedDiffs.forEach(d => console.log(`[${d.status}] ${d.path}\n${d.diff}\n`));

          console.log('\n--- 2. Getting STAGED diffs (all) ---');
          const stagedDiffs = await getWorkingCopyDiffs(repoPath, { staged: true });
          stagedDiffs.forEach(d => console.log(`[${d.status}] ${d.path}\n${d.diff}\n`));
          
          console.log('\n--- 3. Getting diff for a specific UNSTAGED file ---');
          const specificDiff = await getWorkingCopyDiffs(repoPath, { filePaths: ['file1.txt'] });
          specificDiff.forEach(d => console.log(`[${d.status}] ${d.path}\n${d.diff}\n`));
        });
      });
    });
  });
}

setupAndRun();
*/
