import {returnSuccess, safeRegisterTool2} from "@jixo/mcp-core";
import fs from "node:fs";
import {validatePath} from "../fs-utils/path-validation.js";
import {handleToolError} from "../handle-error.js";
import * as s from "../schema.js";
import {server} from "./server.js";

export const write_file_tool = safeRegisterTool2(
  server,
  "write_file",
  {
    description: "Create a new file or completely overwrite an existing file with new content. Use with caution.",
    inputSchema: s.WriteFileArgsSchema,
    outputSuccessSchema: s.CommonSuccessMsgSchema,
  },
  async ({path, content}) => {
    try {
      const validPath = validatePath(path);
      fs.writeFileSync(validPath, content, "utf-8");
      const message = `Successfully wrote to ${path}`;
      return returnSuccess(message, {path: validPath, message});
    } catch (error) {
      return handleToolError("write_file", error);
    }
  },
);
