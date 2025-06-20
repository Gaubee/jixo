import {returnSuccess, safeRegisterTool2} from "@jixo/mcp-core";
import {handleToolError} from "../error.js";
import * as s from "../schema.js";
import {server, withGit} from "./server.js";

export const git_worktree_remove_tool = safeRegisterTool2(
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
