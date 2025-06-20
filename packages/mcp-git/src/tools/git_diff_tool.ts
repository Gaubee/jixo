import {returnSuccess, safeRegisterTool2} from "@jixo/mcp-core";
import {handleToolError} from "../error.js";
import * as s from "../schema.js";
import {server, withGit} from "./server.js";

export const git_diff_tool = safeRegisterTool2(
  server,
  "git_diff",
  {
    description:
      "Shows differences between various repository states. AI DECISION GUIDANCE: This is a flexible diff tool. To compare with a branch, use `target: 'branch_name'`. To compare two branches, use `target: 'branch1..branch2'`.",
    inputSchema: s.GitDiffArgsSchema,
    outputSuccessSchema: s.DiffSuccessSchema,
  },
  async ({repoPath, target}) => {
    try {
      return await withGit(repoPath, async (git) => {
        const diff = (await git.diff(target)).trim();
        return returnSuccess(diff || `No differences found with '${target}'.`, {diff});
      });
    } catch (error) {
      return handleToolError("git_diff", error);
    }
  },
);
