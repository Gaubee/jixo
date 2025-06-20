import {returnSuccess, safeRegisterTool2} from "@jixo/mcp-core";
import {handleToolError} from "../error.js";
import * as s from "../schema.js";
import {server, withGit} from "./server.js";

export const git_tag_tool = safeRegisterTool2(
  server,
  "git_tag",
  {
    description: "Creates a tag to mark a specific point in history, typically used for releases. Can create lightweight or annotated tags.",
    inputSchema: s.GitTagArgsSchema,
    outputSuccessSchema: s.CommonSuccessMsgSchema,
  },
  async ({repoPath, tagName, message}) => {
    try {
      return await withGit(repoPath, async (git) => {
        const result = message ? await git.addAnnotatedTag(tagName, message) : await git.addTag(tagName);
        const successMessage = `Tag '${result.name}' created.`;
        return returnSuccess(successMessage, {message: successMessage});
      });
    } catch (error) {
      return handleToolError("git_tag", error);
    }
  },
);
