import {returnSuccess, safeRegisterTool2} from "@jixo/mcp-core";
import {handleToolError} from "../error.js";
import * as s from "../schema.js";
import {server, withGit} from "./server.js";

export const git_show_tool = safeRegisterTool2(
  server,
  "git_show",
  {
    description:
      "Shows the changes introduced in a specific commit. AI DECISION GUIDANCE: Use `git_log` to find the commit hash you want to inspect, then pass it as the `revision`.",
    inputSchema: s.GitShowArgsSchema,
    outputSuccessSchema: s.DiffSuccessSchema,
  },
  async ({repoPath, revision}) => {
    try {
      return await withGit(repoPath, async (git) => {
        const diff = (await git.show(revision)).trim();
        return returnSuccess(diff, {diff});
      });
    } catch (error) {
      return handleToolError("git_show", error);
    }
  },
);
