import {returnSuccess, safeRegisterTool2} from "@jixo/mcp-core";
import fs from "node:fs";
import {handleToolError} from "../error.js";
import * as s from "../schema.js";
import {server, withGit} from "./server.js";

export const git_worktree_list_tool = safeRegisterTool2(
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
