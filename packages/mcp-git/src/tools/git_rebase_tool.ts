import {returnSuccess, safeRegisterTool2} from "@jixo/mcp-core";
import {GitResponseError} from "simple-git";
import {handleToolError, RebaseConflictError} from "../error.js";
import * as s from "../schema.js";
import {server, withGit} from "./server.js";

export const git_rebase_tool = safeRegisterTool2(
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
