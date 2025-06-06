import {FileEntry, gray, red, walkFiles} from "@gaubee/nodekit";
import {type ExecException, execSync} from "node:child_process";
import path from "node:path";

interface GitError extends ExecException {
  status?: number | null;
  //   stderr?: Buffer | string;
  //   stdout?: Buffer | string;
}

export async function findChangedFilesSinceCommit(messagePattern: string, cwd: string = "."): Promise<FileEntry[]> {
  let repoPath = cwd;
  try {
    // 获取 Git 仓库位置，同时确保在 Git 仓库中运行
    repoPath = execSync("git rev-parse --show-toplevel", {cwd, encoding: "utf8", stdio: "pipe"}).toString().trim();
  } catch (e) {
    return [...walkFiles(repoPath)];
  }
  const gitCommandOptions = {cwd: repoPath, encoding: "utf8" as BufferEncoding, stdio: "pipe" as "pipe"}; // stdio: 'pipe' to access stdout/stderr on error

  let baseCommitForDiff: string | null = null;

  try {
    // 1. 找到包含特定标记的最新 commit SHA
    // 使用 --fixed-strings 来精确匹配字符串 "@jixo"，而不是作为正则表达式
    const targetCommitSha = execSync(`git log --grep="${messagePattern}" --fixed-strings -n 1 --pretty=format:%H`, gitCommandOptions).toString().trim();

    if (targetCommitSha) {
      console.log(`Found target commit SHA: ${targetCommitSha} for message pattern: "${messagePattern}"`);
      baseCommitForDiff = targetCommitSha;
    } else {
      console.warn(gray(`No commit found with message pattern: "${messagePattern}". All files (includes uncommitted changes) will be listed.`));
    }
  } catch (error) {
    // git log --grep 通常在没有匹配时返回空输出和退出码0。
    // 如果这里出错，可能是更严重的问题。
    const gitError = error as GitError;
    console.warn(red(`Could not determine base commit with pattern "${messagePattern}". All files (includes uncommitted changes) will be listed. Details:`));
    console.error(gitError.message);
  }
  if (!baseCommitForDiff) {
    return execSync("git ls-tree HEAD --name-only -r", {cwd, encoding: "utf8", stdio: "pipe"})
      .toString()
      .trim()
      .split("\n")
      .map((filepath) => {
        return new FileEntry(path.join(cwd, filepath), {cwd});
      });
  }

  const changedFiles = new Set<string>();

  // 2. 列出从该 commit 之后到 HEAD (最新已提交) 的所有变更文件

  try {
    const committedChangesOutput = execSync(`git diff ${baseCommitForDiff} HEAD --name-only`, gitCommandOptions).toString().trim();
    if (committedChangesOutput) {
      committedChangesOutput.split("\n").forEach((file) => {
        if (file.trim()) changedFiles.add(file.trim());
      });
    }
  } catch (error) {
    const gitError = error as GitError;
    // `git diff` 在有差异时退出码为1，无差异时为0。execSync 默认在非0时抛错。
    if (gitError.status === 1 && gitError.stdout) {
      // 有差异
      const output = gitError.stdout ?? "";
      if (output) {
        output.split("\n").forEach((file) => {
          if (file.trim()) changedFiles.add(file.trim());
        });
      }
    } else if (gitError.status !== 0) {
      // 其他错误
      console.error(`Error getting committed changes since ${baseCommitForDiff}: ${gitError.stderr || gitError.message}`);
    }
    // status 0 (无差异) 表示没有输出，是正常情况
  }
  // 3. 列出工作区中未提交的变更文件
  const uncommittedCommands = [
    {cmd: "git diff --name-only --cached", desc: "staged changes"}, // 已暂存
    {cmd: "git diff --name-only", desc: "unstaged changes"}, // 未暂存 (对比工作区和暂存区)
    {cmd: "git ls-files --others --exclude-standard", desc: "untracked files"}, // 未跟踪
  ];

  for (const item of uncommittedCommands) {
    try {
      const output = execSync(item.cmd, gitCommandOptions).toString().trim();
      if (output) {
        output.split("\n").forEach((file) => {
          if (file.trim()) changedFiles.add(file.trim());
        });
      }
    } catch (error) {
      const gitError = error as GitError;
      if (item.cmd.startsWith("git diff") && gitError.status === 1 && gitError.stdout) {
        // git diff 有差异
        const output = gitError.stdout ?? "";
        if (output) {
          output.split("\n").forEach((file) => {
            if (file.trim()) changedFiles.add(file.trim());
          });
        }
      } else if (gitError.status !== 0 && !(item.cmd.startsWith("git diff") && gitError.status === 1)) {
        // 其他错误
        // 对于 ls-files，如果出错，也记录
        console.error(`Error getting ${item.desc}: ${gitError.stderr || gitError.message}`);
      }
      // `git ls-files` 在没有文件时退出码为0，输出为空。
      // `git diff` 在没有差异时退出码为0，输出为空。
    }
  }

  // 返回相对于仓库根目录的文件路径
  return [...changedFiles].map((filepath) => new FileEntry(path.resolve(repoPath, filepath), {cwd: repoPath}));
}
