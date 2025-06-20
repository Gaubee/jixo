import {returnSuccess, safeRegisterTool2} from "@jixo/mcp-core";
import {EmptyCommitError, handleToolError} from "../error.js";
import * as s from "../schema.js";
import {server, withGit} from "./server.js";

export const git_commit_tool = safeRegisterTool2(
  server,
  "git_commit",
  {
    description:
      "Records staged changes to the repository with a commit message. AI DECISION GUIDANCE: Run `git_status` and `git_diff_staged` before committing to ensure you are committing the correct changes.",
    inputSchema: s.GitCommitArgsSchema,
    outputSuccessSchema: s.GitCommitSuccessSchema,
  },
  async ({repoPath, message}) => {
    try {
      return await withGit(repoPath, async (git) => {
        const status = await git.status();
        if (status.staged.length === 0 && status.conflicted.length === 0) {
          throw new EmptyCommitError("No changes added to commit. Use `git_add` to stage changes.");
        }
        const commitResult = await git.commit(message);
        const successMessage = `Changes committed successfully with hash ${commitResult.commit}`;
        return returnSuccess(successMessage, {message: successMessage, commitHash: commitResult.commit});
      });
    } catch (error) {
      return handleToolError("git_commit", error);
    }
  },
);
