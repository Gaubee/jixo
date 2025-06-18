import fs from "node:fs";
import {simpleGit, type SimpleGit, type SimpleGitOptions, type StatusResult} from "simple-git";
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

  async status(): Promise<StatusResult> {
    return this.git.status();
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
