import {returnSuccess, safeRegisterTool2} from "@jixo/mcp-core";
import {handleToolError} from "../error.js";
import * as s from "../schema.js";
import {server, withGit} from "./server.js";

export const git_get_repo_info_tool = safeRegisterTool2(
  server,
  "git_get_repo_info",
  {
    description: "Fetches essential repository structural information, such as the root directory path and .git path.",
    inputSchema: s.GitGetRepoInfoArgsSchema,
    outputSuccessSchema: s.GitGetRepoInfoSuccessSchema,
  },
  async ({repoPath}) => {
    try {
      return await withGit(repoPath, async (git) => {
        const repoInfo = await git.getRepoInfo();
        const message = `Repository info retrieved: toplevel='${repoInfo.toplevel}', gitDir='${repoInfo.gitDir}'`;
        return returnSuccess(message, repoInfo);
      });
    } catch (error) {
      return handleToolError("git_get_repo_info", error);
    }
  },
);
