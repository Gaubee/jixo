import {returnSuccess, safeRegisterTool2} from "@jixo/mcp-core";
import {handleToolError} from "../error.js";
import * as s from "../schema.js";
import {server, withGit} from "./server.js";

export const git_stash_pop_tool = safeRegisterTool2(
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
