import {genericErrorRawShape, returnSuccess, safeRegisterTool2} from "@jixo/mcp-core";
import {GitResponseError, type MergeResult} from "simple-git";
import z from "zod/v3";
import {handleToolError, MergeConflictError} from "../error.js";
import * as s from "../schema.js";
import {server, withGit} from "./server.js";

export const git_merge_tool = safeRegisterTool2(
  server,
  "git_merge",
  {
    description:
      "Merges the specified branch into the current branch. AI DECISION GUIDANCE: Use this to integrate feature branches back into your main branch. Handle conflicts if they occur.",
    inputSchema: s.GitMergeArgsSchema,
    outputSuccessSchema: s.GitMergeSuccessSchema,
    outputErrorSchema: {
      ...genericErrorRawShape,
      conflicts: z.string().array().optional().describe("A list of files that have conflicts."),
    },
  },
  async ({repoPath, branch}) => {
    try {
      return await withGit(repoPath, async (git) => {
        await git.merge([branch]);
        return returnSuccess(`Successfully merged branch '${branch}'.`, {
          message: "Merge successful.",
          mergedBranches: [branch],
        });
      });
    } catch (error: any) {
      if (error instanceof GitResponseError && error.git) {
        const gitError = error.git as MergeResult;
        if (gitError.conflicts && gitError.conflicts.length > 0) {
          const conflictFiles = gitError.conflicts.map((c) => c.file).filter(Boolean) as string[];
          return handleToolError(
            "git_merge",
            new MergeConflictError(`Merge conflict detected. Please resolve conflicts in the following files: ${conflictFiles.join(", ")}`, conflictFiles),
          );
        }
      }
      return handleToolError("git_merge", error);
    }
  },
);
