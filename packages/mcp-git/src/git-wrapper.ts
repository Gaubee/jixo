import {locks} from "@gaubee/util";
import fs from "node:fs";
import {
  ResetMode,
  simpleGit,
  type BranchSummary,
  type CommitResult,
  type DefaultLogFields,
  type GitError,
  type ListLogLine,
  type LogResult,
  type MergeResult,
  type SimpleGit,
  type SimpleGitOptions,
  type StatusResult,
} from "simple-git";
import {InvalidRepoError} from "./error.js";

export interface Worktree {
  path: string;
  branch: string;
  isCurrent: boolean;
  isMain: boolean;
  head?: string;
}

export class GitWrapper {
  private git: SimpleGit;
  public readonly repoPath: string;

  constructor(repoPath: string) {
    if (!fs.existsSync(repoPath)) {
      throw new InvalidRepoError(`Cannot use simple-git on a directory that does not exist: "${repoPath}"`);
    }

    this.repoPath = repoPath;
    const options: Partial<SimpleGitOptions> = {
      baseDir: repoPath,
      binary: "git",
      maxConcurrentProcesses: 6,
    };
    this.git = simpleGit(options);
  }

  private async withLock<T>(mode: "shared" | "exclusive", operation: () => Promise<T>): Promise<T> {
    const lockName = `mcp-git:${this.repoPath.replace(/[\/\\?%*:|"<>]+/g, "-")}`;
    return locks.run(lockName, {mode}, operation);
  }

  async validateRepo(): Promise<void> {
    return this.withLock("exclusive", async () => {
      const isRepo = await this.git.checkIsRepo();
      if (!isRepo) {
        throw new InvalidRepoError(`Error validating repository at '${this.repoPath}': Not a git repository.`);
      }
    });
  }

  static async init(repoPath: string): Promise<string> {
    const lockName = `mcp-git:${repoPath.replace(/[\/\\?%*:|"<>]/g, "-")}`;
    return locks.run(lockName, {mode: "exclusive"}, async () => {
      if (!fs.existsSync(repoPath)) {
        fs.mkdirSync(repoPath, {recursive: true});
      }
      const git = simpleGit(repoPath);
      await git.init();
      return `Initialized empty Git repository in ${repoPath}`;
    });
  }

  static async clone(source: string, local: string): Promise<string> {
    const lockName = `mcp-git-clone:${local.replace(/[\/\\?%*:|"<>]/g, "-")}`;
    return locks.run(lockName, {mode: "exclusive"}, async () => {
      await simpleGit().clone(source, local);
      return `Cloned repository from ${source} to ${local}`;
    });
  }

  status(): Promise<StatusResult> {
    return this.withLock("shared", () => this.git.status());
  }

  branch(): Promise<BranchSummary> {
    return this.withLock("shared", () => this.git.branch());
  }

  getUntrackedFiles(): Promise<string[]> {
    return this.withLock("shared", async () => {
      const status = await this.git.status();
      return status.not_added;
    });
  }

  diffUnstaged(): Promise<string> {
    return this.withLock("shared", () => this.git.diff());
  }

  diffStaged(): Promise<string> {
    return this.withLock("shared", () => this.git.diff(["--cached"]));
  }

  diff(target: string): Promise<string> {
    return this.withLock("shared", () => this.git.diff([target]));
  }

  commit(message: string): Promise<CommitResult> {
    return this.withLock("exclusive", () => this.git.commit(message));
  }

  add(files: string[]): Promise<string> {
    return this.withLock("exclusive", async () => {
      await this.git.add(files);
      return "Files staged successfully";
    });
  }

  reset(): Promise<string> {
    return this.withLock("exclusive", async () => {
      await this.git.reset(ResetMode.MIXED);
      return "All staged changes reset";
    });
  }

  log(maxCount: number = 10): Promise<ReadonlyArray<DefaultLogFields & ListLogLine>> {
    return this.withLock("shared", async () => {
      try {
        const log: LogResult = await this.git.log({maxCount});
        return log.all;
      } catch (error: any) {
        const e = error as GitError;
        if (e.message.includes("does not have any commits yet")) {
          return [];
        }
        throw e;
      }
    });
  }

  createBranch(branchName: string, baseBranch?: string): Promise<string> {
    return this.withLock("exclusive", async () => {
      const options = baseBranch ? [baseBranch] : [];
      await this.git.branch([branchName, ...options]);
      const from = baseBranch ?? (await this.git.revparse(["--abbrev-ref", "HEAD"]));
      return `Created branch '${branchName}' from '${from}'`;
    });
  }

  checkout(branchName: string): Promise<string> {
    return this.withLock("exclusive", async () => {
      await this.git.checkout(branchName);
      return `Switched to branch '${branchName}'`;
    });
  }

  show(revision: string): Promise<string> {
    return this.withLock("shared", () => this.git.show(revision));
  }

  merge(args: string[]): Promise<MergeResult> {
    return this.withLock("exclusive", () => this.git.merge(args));
  }

  rebase(args: string[]): Promise<string> {
    return this.withLock("exclusive", () => this.git.rebase(args));
  }

  addTag(tagName: string): Promise<{name: string}> {
    return this.withLock("exclusive", () => this.git.addTag(tagName));
  }

  addAnnotatedTag(tagName: string, tagMessage: string): Promise<{name: string}> {
    return this.withLock("exclusive", () => this.git.addAnnotatedTag(tagName, tagMessage));
  }

  stash(options?: string[]): Promise<string> {
    return this.withLock("exclusive", () => this.git.stash(options));
  }

  stashList(): Promise<LogResult> {
    return this.withLock("shared", () => this.git.stashList());
  }

  worktreeAdd(path: string, branch: string, createBranch: boolean): Promise<string> {
    const args = ["worktree", "add"];
    if (createBranch) {
      args.push("-b", branch);
    }
    args.push(path);
    if (!createBranch) {
      args.push(branch);
    }
    return this.withLock("exclusive", () => this.git.raw(args));
  }

  async worktreeList(): Promise<Omit<Worktree, "isCurrent">[]> {
    return this.withLock("shared", async () => {
      const result = await this.git.raw(["worktree", "list", "--porcelain"]);
      if (!result) {
        const mainPath = (await this.git.revparse(["--show-toplevel"])).trim();
        const mainBranch = (await this.git.revparse(["--abbrev-ref", "HEAD"])).trim();
        return [{path: fs.realpathSync(mainPath), branch: mainBranch, isMain: true}];
      }

      const worktrees: Partial<Omit<Worktree, "isCurrent">>[] = [];
      let currentWorktree: Partial<Omit<Worktree, "isCurrent">> = {};

      for (const line of result.trim().split("\n")) {
        if (line.startsWith("worktree ")) {
          if (currentWorktree.path) {
            worktrees.push(currentWorktree);
          }
          currentWorktree = {path: fs.realpathSync(line.substring(9).trim()), isMain: false};
        } else if (line.startsWith("HEAD ")) {
          currentWorktree.head = line.substring(5).trim();
        } else if (line.startsWith("branch ")) {
          currentWorktree.branch = line.substring(7).trim().replace("refs/heads/", "");
        }
      }
      if (currentWorktree.path) {
        worktrees.push(currentWorktree);
      }

      const mainWorktreePath = fs.realpathSync((await this.git.revparse(["--show-toplevel"])).trim());
      return worktrees.map((w) => ({
        ...w,
        isMain: w.path === mainWorktreePath,
      })) as Omit<Worktree, "isCurrent">[];
    });
  }

  worktreeRemove(path: string): Promise<string> {
    return this.withLock("exclusive", () => this.git.raw(["worktree", "remove", path]));
  }
}
