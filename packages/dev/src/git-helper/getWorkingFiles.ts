import {easySpawn, emptyEasySpawnResult} from "./easyExec.js";
import {parseNameStatus} from "./parseNameStatus.js";
import type {GetGitFilesOptions, GitFileStatus} from "./types.js";

export const getWorkingFiles = async (repoPath: string, options: GetGitFilesOptions) => {
  const fileArgs = options.filePaths && options.filePaths.length > 0 ? ["--", ...options.filePaths] : [];
  const stagedOnly = !!options.staged;

  // --- 步骤 1: 并行发现所有变更文件 ---
  const [stagedResult, unstagedResult, untrackedResult] = await Promise.all([
    easySpawn("git", ["diff", "--staged", "--name-status", ...fileArgs], {cwd: repoPath}),
    stagedOnly ? emptyEasySpawnResult : easySpawn("git", ["diff", "--name-status", ...fileArgs], {cwd: repoPath}),
    stagedOnly ? emptyEasySpawnResult : easySpawn("git", ["ls-files", "--others", "--exclude-standard", ...fileArgs], {cwd: repoPath}),
  ]);

  // --- 步骤 2: 解析和合并文件列表 ---
  const trackedChanges = new Map<string, GitFileStatus>([
    ...parseNameStatus(stagedResult.stdout),
    // 如果是 stagedOnly，unstagedResult.stdout 会是空字符串，无副作用
    ...parseNameStatus(unstagedResult.stdout),
  ]);

  const untrackedFiles = untrackedResult.stdout.trim().split("\n").filter(Boolean);

  return {
    stagedOnly,
    trackedChanges,
    untrackedFiles,
  };
};

export const hasGitHead = async (repoPath: string, verify = "HEAD") => {
  const headExistsResult = await easySpawn("git", ["rev-parse", "--verify", verify], {cwd: repoPath}).catch(() => ({code: 1}));
  return headExistsResult.code === 0;
};
