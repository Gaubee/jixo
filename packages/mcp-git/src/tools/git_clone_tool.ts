import {returnSuccess, safeRegisterTool2} from "@jixo/mcp-core";
import {handleToolError} from "../error.js";
import {GitWrapper} from "../git-wrapper.js";
import * as s from "../schema.js";
import {server} from "./server.js";

export const git_clone_tool = safeRegisterTool2(
  server,
  "git_clone",
  {
    description: "Clones a remote repository into a new local directory.",
    inputSchema: s.GitCloneArgsSchema,
    outputSuccessSchema: s.CommonSuccessMsgSchema,
  },
  async ({source, local}) => {
    try {
      const message = await GitWrapper.clone(source, local);
      return returnSuccess(message, {message});
    } catch (error) {
      return handleToolError("git_clone", error);
    }
  },
);
