import fs from "node:fs";
import {simpleGit, type SimpleGit, type SimpleGitOptions} from "simple-git";
import {InvalidRepoError} from "./error.js";

export class GitWrapper {
  private git: SimpleGit;
  public readonly repoPath: string;

  constructor(repoPath: string) {
    this.repoPath = repoPath;
    const options: Partial<SimpleGitOptions> = {
      baseDir: repoPath,
      binary: "git",
      maxConcurrentProcesses: 6,
    };
    this.git = simpleGit(options);
  }

  async validateRepo(): Promise<void> {
    try {
      const isRepo = await this.git.checkIsRepo();
      if (!isRepo) {
        throw new InvalidRepoError(`The path '${this.repoPath}' is not a valid Git repository.`);
      }
    } catch (e: any) {
      throw new InvalidRepoError(`Error validating repository at '${this.repoPath}': ${e.message}`);
    }
  }

  static async init(repoPath: string): Promise<string> {
    if (!fs.existsSync(repoPath)) {
      fs.mkdirSync(repoPath, {recursive: true});
    }
    const git = simpleGit(repoPath);
    await git.init();
    const repo = new GitWrapper(repoPath);
    return `Initialized empty Git repository in ${repo.repoPath}`;
  }

  async status(): Promise<string> {
    const status = await this.git.status();
    const output: string[] = [];

    output.push(`On branch ${status.current}`);

    if (status.tracking) {
      if (status.ahead > 0 && status.behind > 0) {
        output.push(`Your branch and '${status.tracking}' have diverged,`);
        output.push(`and have ${status.ahead} and ${status.behind} different commits each, respectively.`);
      } else if (status.ahead > 0) {
        output.push(`Your branch is ahead of '${status.tracking}' by ${status.ahead} commit(s).`);
      } else if (status.behind > 0) {
        output.push(`Your branch is behind '${status.tracking}' by ${status.behind} commit(s).`);
      } else {
        output.push(`Your branch is up to date with '${status.tracking}'.`);
      }
    }

    if (status.staged.length > 0) {
      output.push("\nChanges to be committed:");
      status.staged.forEach((file) => output.push(`\tmodified:   ${file}`));
    }

    if (status.conflicted.length > 0) {
      output.push("\nUnmerged paths:");
      status.conflicted.forEach((file) => output.push(`\tboth modified:   ${file}`));
    }

    const notStagedFiles = status.modified.filter((file) => !status.staged.includes(file));
    if (notStagedFiles.length > 0) {
      output.push("\nChanges not staged for commit:");
      notStagedFiles.forEach((file) => output.push(`\tmodified:   ${file}`));
    }
    if (status.deleted.length > 0) {
      if (!output.some((line) => line.includes("Changes not staged for commit"))) {
        output.push("\nChanges not staged for commit:");
      }
      status.deleted.forEach((file) => output.push(`\tdeleted:    ${file}`));
    }

    if (status.not_added.length > 0) {
      output.push("\nUntracked files:");
      status.not_added.forEach((file) => output.push(`\t${file}`));
    }

    if (status.isClean()) {
      output.push("\nnothing to commit, working tree clean");
    }

    return output.join("\n").trim();
  }

  async diffUnstaged(): Promise<string> {
    return this.git.diff();
  }

  async diffStaged(): Promise<string> {
    return this.git.diff(["--cached"]);
  }

  async diff(target: string): Promise<string> {
    return this.git.diff([target]);
  }

  async commit(message: string): Promise<string> {
    const result = await this.git.commit(message);
    return `Changes committed successfully with hash ${result.commit}`;
  }

  async add(files: string[]): Promise<string> {
    await this.git.add(files);
    return "Files staged successfully";
  }

  async reset(): Promise<string> {
    await this.git.reset();
    return "All staged changes reset";
  }

  async log(maxCount: number = 10): Promise<string> {
    const log = await this.git.log({maxCount});
    return log.all
      .map((commit) => `Commit: ${commit.hash}\n` + `Author: ${commit.author_name} <${commit.author_email}>\n` + `Date: ${commit.date}\n` + `Message: ${commit.message}\n`)
      .join("\n");
  }

  async createBranch(branchName: string, baseBranch?: string): Promise<string> {
    const options = baseBranch ? [baseBranch] : [];
    await this.git.branch([branchName, ...options]);
    const from = baseBranch ?? (await this.git.revparse(["--abbrev-ref", "HEAD"]));
    return `Created branch '${branchName}' from '${from}'`;
  }

  async checkout(branchName: string): Promise<string> {
    await this.git.checkout(branchName);
    return `Switched to branch '${branchName}'`;
  }

  async show(revision: string): Promise<string> {
    return this.git.show(revision);
  }
}
