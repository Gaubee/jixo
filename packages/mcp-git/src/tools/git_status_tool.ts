import {returnSuccess, safeRegisterTool2} from "@jixo/mcp-core";
import {handleToolError} from "../error.js";
import {formatStatus, getSemanticFiles} from "../format.js";
import * as s from "../schema.js";
import {server, withGit} from "./server.js";

export const git_status_tool = safeRegisterTool2(
  server,
  "git_status",
  {
    description:
      "Shows the working tree status. AI DECISION GUIDANCE: This is the primary tool to understand the current state of the repository (current branch, staged, unstaged, and untracked files). Run this before and after major operations like `add`, `commit`, or `reset`.",
    inputSchema: s.GitStatusArgsSchema,
    outputSuccessSchema: s.GitStatusOutputSchema,
  },
  async ({repoPath}) => {
    try {
      return await withGit(repoPath, async (git) => {
        const status = await git.status();
        const humanReadableStatus = formatStatus(status);
        const semanticFiles = getSemanticFiles(status.files);
        return returnSuccess(humanReadableStatus, {
          current: status.current,
          tracking: status.tracking,
          ahead: status.ahead,
          behind: status.behind,
          files: semanticFiles,
          isClean: status.isClean(),
        });
      });
    } catch (error) {
      return handleToolError("git_status", error);
    }
  },
);
