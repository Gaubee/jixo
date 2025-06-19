import {genericErrorRawShape, returnSuccess, safeRegisterTool2} from "@jixo/mcp-core";
import {McpServer} from "@modelcontextprotocol/sdk/server/mcp.js";
import {StdioServerTransport} from "@modelcontextprotocol/sdk/server/stdio.js";
import fs from "node:fs";
import path from "node:path";
import {GitResponseError, type MergeResult} from "simple-git";
import z from "zod";
import pkg from "../package.json" with {type: "json"};
import {EmptyCommitError, handleToolError, MergeConflictError, RebaseConflictError} from "./error.js";
import {formatStatus, getSemanticFiles} from "./format.js";
import {GitWrapper} from "./git-wrapper.js";
import * as s from "./schema.js";

export const server = new McpServer({
  name: "mcp-git-server",
  version: pkg.version,
});

async function withGit(repoPath: string, callback: (git: GitWrapper) => Promise<any>) {
  const git = new GitWrapper(repoPath);
  await git.validateRepo();
  return callback(git);
}

const git_init_tool = safeRegisterTool2(
  server,
  "git_init",
  {
    description: "Initializes a new Git repository in a specified directory.",
    inputSchema: s.GitInitArgsSchema,
    outputSuccessSchema: s.CommonSuccessMsgSchema,
  },
  async (args) => {
    try {
      const message = await GitWrapper.init(args.repoPath);
      return returnSuccess(message, {message});
    } catch (error) {
      return handleToolError("git_init", error);
    }
  },
);

const git_clone_tool = safeRegisterTool2(
  server,
  "git_clone",
  {
    description: "Clones a remote repository into a new local directory.",
    inputSchema: s.GitCloneArgsSchema,
    outputSuccessSchema: s.CommonSuccessMsgSchema,
  },
  async ({source, local}) => {
    try {
      const message = await GitWrapper.clone(source, local);
      return returnSuccess(message, {message});
    } catch (error) {
      return handleToolError("git_clone", error);
    }
  },
);

const git_status_tool = safeRegisterTool2(
  server,
  "git_status",
  {
    description:
      "Shows the working tree status. AI DECISION GUIDANCE: This is the primary tool to understand the current state of the repository (current branch, staged, unstaged, and untracked files). Run this before and after major operations like `add`, `commit`, or `reset`.",
    inputSchema: s.GitStatusArgsSchema,
    outputSuccessSchema: s.GitStatusOutputSchema,
  },
  async ({repoPath}) => {
    try {
      return await withGit(repoPath, async (git) => {
        const status = await git.status();
        const humanReadableStatus = formatStatus(status);
        const semanticFiles = getSemanticFiles(status.files);
        return returnSuccess(humanReadableStatus, {
          current: status.current,
          tracking: status.tracking,
          ahead: status.ahead,
          behind: status.behind,
          files: semanticFiles,
          isClean: status.isClean(),
        });
      });
    } catch (error) {
      return handleToolError("git_status", error);
    }
  },
);

const git_diff_unstaged_tool = safeRegisterTool2(
  server,
  "git_diff_unstaged",
  {
    description:
      "Shows diff of changes in the working directory that are not yet staged, including untracked files. AI DECISION GUIDANCE: Use this to review your current, un-staged modifications before deciding to stage them with `git_add`.",
    inputSchema: s.GitDiffUnstagedArgsSchema,
    outputSuccessSchema: s.DiffSuccessSchema,
  },
  async ({repoPath}) => {
    try {
      return await withGit(repoPath, async (git) => {
        const trackedDiff = await git.diffUnstaged();
        const untrackedFiles = await git.getUntrackedFiles();
        const untrackedDiffs = await Promise.all(
          untrackedFiles.map(async (file) => {
            const filePath = path.join(repoPath, file);
            const content = await fs.promises.readFile(filePath, "utf-8");
            const lines = content.split("\n").map((line: string) => `+${line}`);
            return `diff --git a/${file} b/${file}\nnew file mode 100644\nindex 0000000..${"e69de29"}\n--- /dev/null\n+++ b/${file}\n@@ -0,0 +1,${lines.length} @@\n${lines.join("\n")}`;
          }),
        );
        const fullDiff = [trackedDiff, ...untrackedDiffs].filter(Boolean).join("\n").trim();
        return returnSuccess(fullDiff || "No unstaged changes.", {diff: fullDiff});
      });
    } catch (error) {
      return handleToolError("git_diff_unstaged", error);
    }
  },
);

const git_diff_staged_tool = safeRegisterTool2(
  server,
  "git_diff_staged",
  {
    description:
      "Shows diff of changes that are staged for commit. AI DECISION GUIDANCE: Use this as a final review before running `git_commit` to confirm exactly what will be included in the new commit.",
    inputSchema: s.GitDiffStagedArgsSchema,
    outputSuccessSchema: s.DiffSuccessSchema,
  },
  async ({repoPath}) => {
    try {
      return await withGit(repoPath, async (git) => {
        const diff = (await git.diffStaged()).trim();
        return returnSuccess(diff || "No staged changes.", {diff});
      });
    } catch (error) {
      return handleToolError("git_diff_staged", error);
    }
  },
);

const git_diff_tool = safeRegisterTool2(
  server,
  "git_diff",
  {
    description:
      "Shows differences between various repository states. AI DECISION GUIDANCE: This is a flexible diff tool. To compare with a branch, use `target: 'branch_name'`. To compare two branches, use `target: 'branch1..branch2'`.",
    inputSchema: s.GitDiffArgsSchema,
    outputSuccessSchema: s.DiffSuccessSchema,
  },
  async ({repoPath, target}) => {
    try {
      return await withGit(repoPath, async (git) => {
        const diff = (await git.diff(target)).trim();
        return returnSuccess(diff || `No differences found with '${target}'.`, {diff});
      });
    } catch (error) {
      return handleToolError("git_diff", error);
    }
  },
);

const git_commit_tool = safeRegisterTool2(
  server,
  "git_commit",
  {
    description:
      "Records staged changes to the repository with a commit message. AI DECISION GUIDANCE: Run `git_status` and `git_diff_staged` before committing to ensure you are committing the correct changes.",
    inputSchema: s.GitCommitArgsSchema,
    outputSuccessSchema: s.GitCommitSuccessSchema,
  },
  async ({repoPath, message}) => {
    try {
      return await withGit(repoPath, async (git) => {
        const status = await git.status();
        if (status.staged.length === 0 && status.conflicted.length === 0) {
          throw new EmptyCommitError("No changes added to commit. Use `git_add` to stage changes.");
        }
        const commitResult = await git.commit(message);
        const successMessage = `Changes committed successfully with hash ${commitResult.commit}`;
        return returnSuccess(successMessage, {message: successMessage, commitHash: commitResult.commit});
      });
    } catch (error) {
      return handleToolError("git_commit", error);
    }
  },
);

const git_add_tool = safeRegisterTool2(
  server,
  "git_add",
  {
    description:
      "Adds file contents to the staging area. USAGE PATTERNS: Use `files: ['src/file.js']` for a single file, `files: ['src/']` for a directory, or `files: ['.']` to stage all changes.",
    inputSchema: s.GitAddArgsSchema,
    outputSuccessSchema: s.CommonSuccessMsgSchema,
  },
  async ({repoPath, files}) => {
    try {
      return await withGit(repoPath, async (git) => {
        const message = await git.add(files);
        return returnSuccess(message, {message});
      });
    } catch (error) {
      return handleToolError("git_add", error);
    }
  },
);

const git_reset_tool = safeRegisterTool2(
  server,
  "git_reset",
  {
    description:
      "Resets the staging area. This unstages all currently staged changes, moving them back to the working directory. AI DECISION GUIDANCE: Use this if you have staged files incorrectly with `git_add` and want to re-evaluate.",
    inputSchema: s.GitResetArgsSchema,
    outputSuccessSchema: s.CommonSuccessMsgSchema,
  },
  async ({repoPath}) => {
    try {
      return await withGit(repoPath, async (git) => {
        const message = await git.reset();
        return returnSuccess(message, {message});
      });
    } catch (error) {
      return handleToolError("git_reset", error);
    }
  },
);

const git_log_tool = safeRegisterTool2(
  server,
  "git_log",
  {
    description:
      "Shows the commit logs. Provides a list of recent commits with their hash, author, date, and message. AI DECISION GUIDANCE: Use this to get context on recent changes or to find a specific commit hash for other commands like `git_show`.",
    inputSchema: s.GitLogArgsSchema,
    outputSuccessSchema: s.GitLogSuccessSchema,
  },
  async ({repoPath, maxCount}) => {
    try {
      return await withGit(repoPath, async (git) => {
        const commits = await git.log(maxCount);
        const humanReadableLog =
          "Commit history:\n" +
          commits
            .map((commit) => `Commit: ${commit.hash}\n` + `Author: ${commit.author_name} <${commit.author_email}>\n` + `Date: ${commit.date}\n` + `Message: ${commit.message}\n`)
            .join("\n");
        return returnSuccess(humanReadableLog, {commits});
      });
    } catch (error) {
      return handleToolError("git_log", error);
    }
  },
);

const git_create_branch_tool = safeRegisterTool2(
  server,
  "git_create_branch",
  {
    description:
      "Creates a new branch. AI DECISION GUIDANCE: It's best practice to create a new branch for each new feature or bug fix. Use `git_checkout` to switch to the new branch after creation.",
    inputSchema: s.GitCreateBranchArgsSchema,
    outputSuccessSchema: s.CommonSuccessMsgSchema,
  },
  async ({repoPath, branchName, baseBranch}) => {
    try {
      return await withGit(repoPath, async (git) => {
        const message = await git.createBranch(branchName, baseBranch);
        return returnSuccess(message, {message});
      });
    } catch (error) {
      return handleToolError("git_create_branch", error);
    }
  },
);

const git_checkout_tool = safeRegisterTool2(
  server,
  "git_checkout",
  {
    description: "Switches to a different branch. AI DECISION GUIDANCE: Use this to start working on a different feature or to return to the 'main' branch.",
    inputSchema: s.GitCheckoutArgsSchema,
    outputSuccessSchema: s.CommonSuccessMsgSchema,
  },
  async ({repoPath, branchName}) => {
    try {
      return await withGit(repoPath, async (git) => {
        const message = await git.checkout(branchName);
        return returnSuccess(message, {message});
      });
    } catch (error) {
      return handleToolError("git_checkout", error);
    }
  },
);

const git_show_tool = safeRegisterTool2(
  server,
  "git_show",
  {
    description:
      "Shows the changes introduced in a specific commit. AI DECISION GUIDANCE: Use `git_log` to find the commit hash you want to inspect, then pass it as the `revision`.",
    inputSchema: s.GitShowArgsSchema,
    outputSuccessSchema: s.DiffSuccessSchema,
  },
  async ({repoPath, revision}) => {
    try {
      return await withGit(repoPath, async (git) => {
        const diff = (await git.show(revision)).trim();
        return returnSuccess(diff, {diff});
      });
    } catch (error) {
      return handleToolError("git_show", error);
    }
  },
);

const git_merge_tool = safeRegisterTool2(
  server,
  "git_merge",
  {
    description:
      "Merges the specified branch into the current branch. AI DECISION GUIDANCE: Use this to integrate feature branches back into your main branch. Handle conflicts if they occur.",
    inputSchema: s.GitMergeArgsSchema,
    outputSuccessSchema: s.GitMergeSuccessSchema,
    outputErrorSchema: {
      ...genericErrorRawShape,
      conflicts: z.string().array().optional().describe("A list of files that have conflicts."),
    },
  },
  async ({repoPath, branch}) => {
    try {
      return await withGit(repoPath, async (git) => {
        await git.merge([branch]);
        return returnSuccess(`Successfully merged branch '${branch}'.`, {
          message: "Merge successful.",
          mergedBranches: [branch],
        });
      });
    } catch (error: any) {
      if (error instanceof GitResponseError && error.git) {
        const gitError = error.git as MergeResult;
        if (gitError.conflicts && gitError.conflicts.length > 0) {
          const conflictFiles = gitError.conflicts.map((c) => c.file).filter(Boolean) as string[];
          return handleToolError(
            "git_merge",
            new MergeConflictError(`Merge conflict detected. Please resolve conflicts in the following files: ${conflictFiles.join(", ")}`, conflictFiles),
          );
        }
      }
      return handleToolError("git_merge", error);
    }
  },
);

const git_rebase_tool = safeRegisterTool2(
  server,
  "git_rebase",
  {
    description:
      "Re-applies commits from the current branch onto a new base branch, creating a linear history. AI DECISION GUIDANCE: Use this for a cleaner history than `merge`. Can cause conflicts that must be resolved.",
    inputSchema: s.GitRebaseArgsSchema,
    outputSuccessSchema: s.CommonSuccessMsgSchema,
  },
  async ({repoPath, baseBranch}) => {
    try {
      return await withGit(repoPath, async (git) => {
        const result = await git.rebase([baseBranch]);
        return returnSuccess(result, {message: result});
      });
    } catch (error: any) {
      if (error instanceof GitResponseError && error.message.includes("conflict")) {
        return handleToolError("git_rebase", new RebaseConflictError(`Rebase conflict detected. Please resolve conflicts and then continue or abort the rebase.`));
      }
      return handleToolError("git_rebase", error);
    }
  },
);

const git_stash_push_tool = safeRegisterTool2(
  server,
  "git_stash_push",
  {
    description:
      "Temporarily shelves (or stashes) changes you've made to your working copy so you can work on something else. AI DECISION GUIDANCE: Use this when you need to quickly switch context without committing half-done work.",
    inputSchema: s.GitStashPushArgsSchema,
    outputSuccessSchema: s.CommonSuccessMsgSchema,
  },
  async ({repoPath, message}) => {
    try {
      return await withGit(repoPath, async (git) => {
        const options = message ? ["push", "-m", message] : ["push"];
        const result = await git.stash(options);
        return returnSuccess(result, {message: result});
      });
    } catch (error) {
      return handleToolError("git_stash_push", error);
    }
  },
);

const git_stash_list_tool = safeRegisterTool2(
  server,
  "git_stash_list",
  {
    description: "Lists all stashed changesets.",
    inputSchema: s.GitStashListArgsSchema,
    outputSuccessSchema: s.GitStashListSuccessSchema,
  },
  async ({repoPath}) => {
    try {
      return await withGit(repoPath, async (git) => {
        const result = await git.stashList();
        const stashes = result.all.map((s) => ({hash: s.hash, refs: s.refs, message: s.message}));
        return returnSuccess(result.all.map((s) => `${s.refs[0]}: ${s.message}`).join("\n") || "No stashes found.", {stashes});
      });
    } catch (error) {
      return handleToolError("git_stash_list", error);
    }
  },
);

const git_stash_pop_tool = safeRegisterTool2(
  server,
  "git_stash_pop",
  {
    description: "Removes a single stashed state from the stash list and applies it on top of the current working tree state.",
    inputSchema: s.GitStashPopArgsSchema,
    outputSuccessSchema: s.CommonSuccessMsgSchema,
  },
  async ({repoPath, index}) => {
    try {
      return await withGit(repoPath, async (git) => {
        const options = index !== undefined ? ["pop", `stash@{${index}}`] : ["pop"];
        const result = await git.stash(options);
        return returnSuccess(result, {message: result});
      });
    } catch (error) {
      return handleToolError("git_stash_pop", error);
    }
  },
);

const git_tag_tool = safeRegisterTool2(
  server,
  "git_tag",
  {
    description: "Creates a tag to mark a specific point in history, typically used for releases. Can create lightweight or annotated tags.",
    inputSchema: s.GitTagArgsSchema,
    outputSuccessSchema: s.CommonSuccessMsgSchema,
  },
  async ({repoPath, tagName, message}) => {
    try {
      return await withGit(repoPath, async (git) => {
        const result = message ? await git.addAnnotatedTag(tagName, message) : await git.addTag(tagName);
        const successMessage = `Tag '${result.name}' created.`;
        return returnSuccess(successMessage, {message: successMessage});
      });
    } catch (error) {
      return handleToolError("git_tag", error);
    }
  },
);

const git_worktree_add_tool = safeRegisterTool2(
  server,
  "git_worktree_add",
  {
    description:
      "Creates a new worktree linked to this repository, allowing for concurrent work on different branches. AI DECISION GUIDANCE: Use this to start a new task (e.g., a feature or bugfix) in an isolated directory without switching your main branch.",
    inputSchema: s.GitWorktreeAddArgsSchema,
    outputSuccessSchema: s.CommonSuccessMsgSchema,
  },
  async ({repoPath, path: worktreePath, branch, createBranch}) => {
    try {
      return await withGit(repoPath, async (git) => {
        await git.worktreeAdd(worktreePath, branch, createBranch);
        const message = `Successfully created worktree at '${worktreePath}' for branch '${branch}'.`;
        return returnSuccess(message, {message});
      });
    } catch (error) {
      return handleToolError("git_worktree_add", error);
    }
  },
);

const git_worktree_list_tool = safeRegisterTool2(
  server,
  "git_worktree_list",
  {
    description: "Lists all worktrees for the repository. AI DECISION GUIDANCE: Use this to get an overview of all ongoing tasks and their corresponding directories.",
    inputSchema: s.GitWorktreeListArgsSchema,
    outputSuccessSchema: s.GitWorktreeListSuccessSchema,
  },
  async ({repoPath}) => {
    try {
      return await withGit(repoPath, async (git) => {
        const worktrees = await git.worktreeList();
        const resolvedRepoPath = fs.realpathSync(git.repoPath);
        const allWorktrees = worktrees.map((w) => ({...w, isCurrent: w.path === resolvedRepoPath}));
        return returnSuccess(allWorktrees.map((w) => `${w.path}\t${w.branch}`).join("\n"), {worktrees: allWorktrees});
      });
    } catch (error) {
      return handleToolError("git_worktree_list", error);
    }
  },
);

const git_worktree_remove_tool = safeRegisterTool2(
  server,
  "git_worktree_remove",
  {
    description: "Removes an existing worktree. AI DECISION GUIDANCE: Use this to clean up after a feature branch has been merged and is no longer needed.",
    inputSchema: s.GitWorktreeRemoveArgsSchema,
    outputSuccessSchema: s.CommonSuccessMsgSchema,
  },
  async ({repoPath, path: worktreePath}) => {
    try {
      return await withGit(repoPath, async (git) => {
        await git.worktreeRemove(worktreePath);
        const message = `Successfully removed worktree at '${worktreePath}'.`;
        return returnSuccess(message, {message});
      });
    } catch (error) {
      return handleToolError("git_worktree_remove", error);
    }
  },
);

export const tools = {
  git_init: git_init_tool,
  git_clone: git_clone_tool,
  git_status: git_status_tool,
  git_diff_unstaged: git_diff_unstaged_tool,
  git_diff_staged: git_diff_staged_tool,
  git_diff: git_diff_tool,
  git_commit: git_commit_tool,
  git_add: git_add_tool,
  git_reset: git_reset_tool,
  git_log: git_log_tool,
  git_create_branch: git_create_branch_tool,
  git_checkout: git_checkout_tool,
  git_show: git_show_tool,
  git_merge: git_merge_tool,
  git_rebase: git_rebase_tool,
  git_stash_push: git_stash_push_tool,
  git_stash_list: git_stash_list_tool,
  git_stash_pop: git_stash_pop_tool,
  git_tag: git_tag_tool,
  git_worktree_add: git_worktree_add_tool,
  git_worktree_list: git_worktree_list_tool,
  git_worktree_remove: git_worktree_remove_tool,
};

export async function startServer(repositoryPath?: string) {
  if (repositoryPath) {
    const absolutePath = path.resolve(repositoryPath);
    if (!fs.existsSync(absolutePath)) {
      console.error(`Error: Repository path does not exist: ${absolutePath}`);
      process.exit(1);
    }
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error("MCP Git Server running on stdio.");
  if (repositoryPath) {
    console.error(`Default repository: ${path.resolve(repositoryPath)}`);
  } else {
    console.error("No default repository specified. 'repoPath' must be provided in each tool call.");
  }
}
