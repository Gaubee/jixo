import {logger, returnSuccess} from "@jixo/mcp-core";
import fs from "node:fs";
import {validatePath} from "../fs-utils/path-validation.js";
import {handleToolError} from "../handle-error.js";
import * as s from "../schema.js";
import {registerTool} from "./server.js";

export const create_directory_tool = registerTool(
  "readwrite",
  "create_directory",
  {
    description: `
Create a new directory. It will also create any necessary parent directories along the path.

**AI Decision Guidance**:
- Use this to set up the folder structure for a new project or component.
- This tool is idempotent: if the directory already exists, the operation will succeed without making any changes.
    `,
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
