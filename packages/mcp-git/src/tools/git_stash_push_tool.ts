import {returnSuccess, safeRegisterTool2} from "@jixo/mcp-core";
import {handleToolError} from "../error.js";
import * as s from "../schema.js";
import {server, withGit} from "./server.js";

export const git_stash_push_tool = safeRegisterTool2(
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
