import {returnSuccess, safeRegisterTool2} from "@jixo/mcp-core";
import {handleToolError} from "../error.js";
import * as s from "../schema.js";
import {server, withGit} from "./server.js";

export const git_get_ref_name_tool = safeRegisterTool2(
  server,
  "git_get_ref_name",
  {
    description: "Resolves a reference to its symbolic, human-readable name (e.g., gets 'main' from 'HEAD').",
    inputSchema: s.GitGetRefNameArgsSchema,
    outputSuccessSchema: s.GitGetRefNameSuccessSchema,
  },
  async ({repoPath, ref}) => {
    try {
      return await withGit(repoPath, async (git) => {
        const name = (await git.revParse(["--abbrev-ref", ref])).trim();
        return returnSuccess(`Resolved '${ref}' to symbolic name '${name}'`, {name});
      });
    } catch (error) {
      return handleToolError("git_get_ref_name", error);
    }
  },
);
