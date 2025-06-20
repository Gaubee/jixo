import {returnSuccess, safeRegisterTool2} from "@jixo/mcp-core";
import {handleToolError} from "../error.js";
import * as s from "../schema.js";
import {server, withGit} from "./server.js";

export const git_create_branch_tool = safeRegisterTool2(
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
