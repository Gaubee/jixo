import {returnSuccess, safeRegisterTool2} from "@jixo/mcp-core";
import {handleToolError} from "../error.js";
import * as s from "../schema.js";
import {server, withGit} from "./server.js";

export const git_reset_tool = safeRegisterTool2(
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
