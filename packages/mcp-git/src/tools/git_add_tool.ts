import {returnSuccess, safeRegisterTool2} from "@jixo/mcp-core";
import {handleToolError} from "../error.js";
import * as s from "../schema.js";
import {server, withGit} from "./server.js";

export const git_add_tool = safeRegisterTool2(
  server,
  "git_add",
  {
    description:
      "Adds file contents to the staging area. USAGE PATTERNS: Use `files: ['src/file.js']` for a single file, `files: ['src/']` for a directory, or `files: ['.']` to stage all changes.",
    inputSchema: s.GitAddArgsSchema,
    outputSuccessSchema: s.CommonSuccessMsgSchema,
  },
  async ({repoPath, files}) => {
    try {
      return await withGit(repoPath, async (git) => {
        const message = await git.add(files);
        return returnSuccess(message, {message});
      });
    } catch (error) {
      return handleToolError("git_add", error);
    }
  },
);
