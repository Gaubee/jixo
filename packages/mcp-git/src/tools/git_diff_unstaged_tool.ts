import {returnSuccess, safeRegisterTool2} from "@jixo/mcp-core";
import fs from "node:fs";
import path from "node:path";
import {handleToolError} from "../error.js";
import * as s from "../schema.js";
import {server, withGit} from "./server.js";

export const git_diff_unstaged_tool = safeRegisterTool2(
  server,
  "git_diff_unstaged",
  {
    description:
      "Shows diff of changes in the working directory that are not yet staged, including untracked files. AI DECISION GUIDANCE: Use this to review your current, un-staged modifications before deciding to stage them with `git_add`.",
    inputSchema: s.GitDiffUnstagedArgsSchema,
    outputSuccessSchema: s.DiffSuccessSchema,
  },
  async ({repoPath}) => {
    try {
      return await withGit(repoPath, async (git) => {
        const trackedDiff = await git.diffUnstaged();
        const untrackedFiles = await git.getUntrackedFiles();
        const untrackedDiffs = await Promise.all(
          untrackedFiles.map(async (file) => {
            const filePath = path.join(repoPath, file);
            const content = await fs.promises.readFile(filePath, "utf-8");
            const lines = content.split("\n").map((line: string) => `+${line}`);
            return `diff --git a/${file} b/${file}\nnew file mode 100644\nindex 0000000..${"e69de29"}\n--- /dev/null\n+++ b/${file}\n@@ -0,0 +1,${lines.length} @@\n${lines.join("\n")}`;
          }),
        );
        const fullDiff = [trackedDiff, ...untrackedDiffs].filter(Boolean).join("\n").trim();
        return returnSuccess(fullDiff || "No unstaged changes.", {diff: fullDiff});
      });
    } catch (error) {
      return handleToolError("git_diff_unstaged", error);
    }
  },
);
