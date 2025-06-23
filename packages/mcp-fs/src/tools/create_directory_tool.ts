import {logger, returnSuccess, safeRegisterTool2} from "@jixo/mcp-core";
import fs from "node:fs";
import {validatePath} from "../fs-utils/path-validation.js";
import {handleToolError} from "../handle-error.js";
import * as s from "../schema.js";
import {server} from "./server.js";

export const create_directory_tool = safeRegisterTool2(
  server,
  "create_directory",
  {
    description: "Create a new directory, including any necessary parent directories.",
    inputSchema: s.CreateDirectoryArgsSchema,
    outputSuccessSchema: s.CreateDirectorySuccessSchema,
  },
  async ({path}) => {
    try {
      const validPath = validatePath(path);
      fs.mkdirSync(validPath, {recursive: true});
      const message = `Successfully created directory ${path}`;
      logger.error("[SUCCESS]", "create_directory", message);
      return returnSuccess(message, {path: validPath, message});
    } catch (error) {
      logger.error("[ERROR]", "create_directory", error);
      return handleToolError("create_directory", error);
    }
  },
);
