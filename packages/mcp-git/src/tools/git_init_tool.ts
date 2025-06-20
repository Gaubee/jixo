import {returnSuccess, safeRegisterTool2} from "@jixo/mcp-core";
import {handleToolError} from "../error.js";
import {GitWrapper} from "../git-wrapper.js";
import * as s from "../schema.js";
import {server} from "./server.js";

export const git_init_tool = safeRegisterTool2(
  server,
  "git_init",
  {
    description: "Initializes a new Git repository in a specified directory.",
    inputSchema: s.GitInitArgsSchema,
    outputSuccessSchema: s.CommonSuccessMsgSchema,
  },
  async (args) => {
    try {
      const message = await GitWrapper.init(args.repoPath);
      return returnSuccess(message, {message});
    } catch (error) {
      return handleToolError("git_init", error);
    }
  },
);
