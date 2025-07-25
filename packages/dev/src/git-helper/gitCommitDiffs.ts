import {easySpawn} from "./easyExec.js";
import {parseNameStatus} from "./parseNameStatus.js";
import {simplifyDiffForAI} from "./simplifyDiffForAI.js";
import type {GitFileDiffResult} from "./types.js";

/**
 * 高效、安全地获取某次提交引入的变更 diff 内容。
 * 此函数是只读的，并且其输出经过优化，以最大限度地减少 AI 的 token 消耗。
 *
 * @param repoPath git 仓库的绝对路径。
 * @param commitRef 要查询的 commit 引用 (例如 'HEAD', 'main', 或一个 commit hash)。
 * @param filePaths (可选) 一个文件路径数组。如果提供，则只获取这些文件的 diff；否则获取该次提交中所有文件的 diff。
 * @returns 一个 Promise，它解析为一个包含文件 diff 信息的数组。
 */
export async function gitCommitDiffs(repoPath: string, commitRef: string, filePaths?: string[]): Promise<GitFileDiffResult[]> {
  // --- 步骤 1: 发现变更文件 ---
  // 使用 `git diff-tree`，这是发现一个 commit 变更最快、最精确的底层命令。
  // 其输出格式与 `git diff --name-status` 兼容，可复用解析逻辑。
  const fileArgs = filePaths && filePaths.length > 0 ? ["--", ...filePaths] : [];
  const discoveryArgs = [
    "diff-tree",
    "--no-commit-id", // 省略 commit hash 输出
    "--name-status", // 输出文件状态和路径
    "-r", // 递归到子目录
    commitRef,
    ...fileArgs,
  ];

  const discoveryResult = await easySpawn("git", discoveryArgs, {cwd: repoPath});
  const changedFiles = parseNameStatus(discoveryResult.stdout);

  if (changedFiles.length === 0) {
    return [];
  }

  // --- 步骤 2: 批量获取并简化 Diff ---
  // 使用一次 `git show` 调用，高效地获取所有变更文件的 diff 内容。
  const changedFilePaths = Array.from(changedFiles, (v) => v[0]);
  const showArgs = [
    "show",
    commitRef,
    "--", // 分隔符，确保文件名不会被误解为参数
    ...changedFilePaths,
  ];

  const diffResult = await easySpawn("git", showArgs, {cwd: repoPath});

  // --- 步骤 3: 解析并组装结果 ---
  const diffs: GitFileDiffResult[] = [];
  const diffChunks = diffResult.stdout.trim().split("\ndiff --git ");

  // 跳过第一个元素，因为它通常是 commit 信息
  const changedFilesMap = new Map(changedFiles)
  for (const chunk of diffChunks.slice(1)) {
    const fullDiff = "diff --git " + chunk;
    const firstLine = fullDiff.substring(0, fullDiff.indexOf("\n"));

    // 使用更健壮的正则来匹配文件名
    const pathMatch = firstLine.match(/ b\/(.*)$/s);
    if (pathMatch) {
      const path = pathMatch[1].trim();
      const status = changedFilesMap.get(path);

      if (status) {
        diffs.push({
          path,
          status,
          diff: simplifyDiffForAI(fullDiff),
        });
      }
    }
  }

  return diffs;
}
