import {returnSuccess, safeRegisterTool2} from "@jixo/mcp-core";
import {handleToolError} from "../error.js";
import * as s from "../schema.js";
import {server, withGit} from "./server.js";

export const git_worktree_add_tool = safeRegisterTool2(
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
