import {returnSuccess, safeRegisterTool2} from "@jixo/mcp-core";
import {handleToolError} from "../error.js";
import * as s from "../schema.js";
import {server, withGit} from "./server.js";

export const git_stash_list_tool = safeRegisterTool2(
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
