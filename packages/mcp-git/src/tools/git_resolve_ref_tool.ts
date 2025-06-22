import {returnSuccess, safeRegisterTool2} from "@jixo/mcp-core";
import {handleToolError} from "../error.js";
import * as s from "../schema.js";
import {server, withGit} from "./server.js";

export const git_resolve_ref_tool = safeRegisterTool2(
  server,
  "git_resolve_ref",
  {
    description: "Resolves a symbolic reference (like a branch name, tag, or 'HEAD') to its absolute commit hash.",
    inputSchema: s.GitResolveRefArgsSchema,
    outputSuccessSchema: s.GitResolveRefSuccessSchema,
  },
  async ({repoPath, ref}) => {
    try {
      return await withGit(repoPath, async (git) => {
        const commitHash = (await git.revParse([ref])).trim();
        return returnSuccess(`Resolved '${ref}' to ${commitHash}`, {commitHash});
      });
    } catch (error) {
      return handleToolError("git_resolve_ref", error);
    }
  },
);
