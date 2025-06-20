import {returnSuccess, safeRegisterTool2} from "@jixo/mcp-core";
import {handleToolError} from "../error.js";
import * as s from "../schema.js";
import {server, withGit} from "./server.js";

export const git_checkout_tool = safeRegisterTool2(
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
