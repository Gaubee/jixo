import {returnSuccess, safeRegisterTool2} from "@jixo/mcp-core";
import {handleToolError} from "../error.js";
import * as s from "../schema.js";
import {server, withGit} from "./server.js";

export const git_diff_staged_tool = safeRegisterTool2(
  server,
  "git_diff_staged",
  {
    description:
      "Shows diff of changes that are staged for commit. AI DECISION GUIDANCE: Use this as a final review before running `git_commit` to confirm exactly what will be included in the new commit.",
    inputSchema: s.GitDiffStagedArgsSchema,
    outputSuccessSchema: s.DiffSuccessSchema,
  },
  async ({repoPath}) => {
    try {
      return await withGit(repoPath, async (git) => {
        const diff = (await git.diffStaged()).trim();
        return returnSuccess(diff || "No staged changes.", {diff});
      });
    } catch (error) {
      return handleToolError("git_diff_staged", error);
    }
  },
);
