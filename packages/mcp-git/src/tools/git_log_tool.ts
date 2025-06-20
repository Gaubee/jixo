import {returnSuccess, safeRegisterTool2} from "@jixo/mcp-core";
import {handleToolError} from "../error.js";
import * as s from "../schema.js";
import {server, withGit} from "./server.js";

export const git_log_tool = safeRegisterTool2(
  server,
  "git_log",
  {
    description:
      "Shows the commit logs. Provides a list of recent commits with their hash, author, date, and message. AI DECISION GUIDANCE: Use this to get context on recent changes or to find a specific commit hash for other commands like `git_show`.",
    inputSchema: s.GitLogArgsSchema,
    outputSuccessSchema: s.GitLogSuccessSchema,
  },
  async ({repoPath, maxCount}) => {
    try {
      return await withGit(repoPath, async (git) => {
        const commits = await git.log(maxCount);
        const humanReadableLog =
          "Commit history:\n" +
          commits
            .map((commit) => `Commit: ${commit.hash}\n` + `Author: ${commit.author_name} <${commit.author_email}>\n` + `Date: ${commit.date}\n` + `Message: ${commit.message}\n`)
            .join("\n");
        return returnSuccess(humanReadableLog, {commits});
      });
    } catch (error) {
      return handleToolError("git_log", error);
    }
  },
);
