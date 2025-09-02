import {promises as fs} from "node:fs";
import {join as pathJoin} from "node:path";
import {easySpawn} from "./easyExec.js";
import {getWorkingFiles, hasGitHead} from "./getWorkingFiles.js";
import {simplifyDiffForAI} from "./simplifyDiffForAI.js";
import type {GetGitFilesOptions, GitFileDiffResult, GitFileStatus} from "./types.js";

/**
 * 高效、安全地获取工作区中所有或仅暂存的变更 diff 内容。
 * 此函数是只读的，不会修改 Git 仓库的任何状态。
 *
 * @param repoPath git 仓库的绝对路径。
 * @param options (可选) 配置对象。
 * @param options.filePaths (可选) 一个文件路径数组。如果提供，则只获取这些文件的 diff。
 * @param options.staged (可选) 如果为 true，则仅获取暂存区的变更。默认为 false (获取所有变更)。
 * @returns 一个 Promise，它解析为一个包含所有文件 diff 信息的数组。
 */
export async function gitWorkingDiffs(repoPath: string, options: GetGitFilesOptions): Promise<GitFileDiffResult[]> {
  const {stagedOnly, trackedChanges, untrackedFiles} = await getWorkingFiles(repoPath, options);

  const diffPromises: Promise<GitFileDiffResult | GitFileDiffResult[]>[] = [];

  // --- 步骤 3: 为不同类型的变更生成 Diff ---

  // A. 为所有已跟踪的文件批量生成 Diff
  if (trackedChanges.size > 0) {
    const trackedFilesPaths = [...trackedChanges.keys()];
    // FIX: 根据 stagedOnly 标志选择正确的 diff 命令
    let diffArgs: string[];
    if (stagedOnly) {
      // 如果只看暂存区，必须使用 'git diff --staged'
      diffArgs = ["diff", "--staged", "-M", "-C", "--", ...trackedFilesPaths];
    } else {
      const hasHead = await hasGitHead(repoPath);
      // 如果看所有变更，则统一比较工作区和 HEAD
      const diffCmd = hasHead ? "diff" : "diff --staged";
      const diffBase = hasHead ? "HEAD" : "";
      // 避免当 diffBase 为空时，向参数列表添加一个空字符串
      diffArgs = diffBase ? [diffCmd, diffBase, "-M", "-C", "--", ...trackedFilesPaths] : [diffCmd, "--", ...trackedFilesPaths];
    }

    const promise = easySpawn("git", diffArgs, {cwd: repoPath}).then((result) => {
      const diffs: GitFileDiffResult[] = [];
      const diffChunks = result.stdout.trim().split("\ndiff --git ");

      for (const chunk of diffChunks.filter(Boolean)) {
        const fullDiff = chunk.startsWith("diff --git ") ? chunk : "diff --git " + chunk;
        const firstLine = fullDiff.substring(0, fullDiff.indexOf("\n"));
        const pathMatch = firstLine.match(/ b\/(.*)$/s);
        if (pathMatch) {
          const path = pathMatch[1].trim();
          const status = trackedChanges.get(path);
          if (status) {
            diffs.push({path, status, diff: simplifyDiffForAI(fullDiff)});
          }
        }
      }
      return diffs;
    });
    diffPromises.push(promise);
  }

  // B. 为新增的未跟踪文件并行、高效地生成极简 Diff (使用 fs.readFile)
  untrackedFiles.forEach((path) => {
    const absolutePath = pathJoin(repoPath, path);
    const promise = fs.readFile(absolutePath, "utf-8").then((content) => {
      // 手动创建一个最基本的 diff 结构，然后简化它
      const lines = content.split("\n");
      const hunkHeader = `@@ -0,0 +1,${lines.length} @@`;
      const diffBody = lines.map((line) => `+${line}`).join("\n");
      const simplifiedDiff = `${hunkHeader}\n${diffBody}`;

      return {
        path,
        status: "A" as GitFileStatus,
        diff: simplifiedDiff,
      };
    });
    diffPromises.push(promise);
  });

  // --- 步骤 4: 合并所有结果 ---
  const results = await Promise.all(diffPromises);
  return results.flat();
}
