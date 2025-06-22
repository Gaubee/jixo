import {returnSuccess, safeRegisterTool2} from "@jixo/mcp-core";
import fs from "node:fs";
import {validatePath} from "../fs-utils/path-validation.js";
import {handleToolError} from "../handle-error.js";
import * as s from "../schema.js";
import {server} from "./server.js";

export const move_file_tool = safeRegisterTool2(
  server,
  "move_file",
  {
    description: "Move or rename a file or directory.",
    inputSchema: s.MoveFileArgsSchema,
    outputSuccessSchema: s.CommonSuccessMsgSchema,
  },
  async ({source, destination}) => {
    try {
      const validSource = validatePath(source);
      const validDest = validatePath(destination);
      fs.renameSync(validSource, validDest);
      const message = `Successfully moved ${source} to ${destination}`;
      return returnSuccess(message, {source: validSource, destination: validDest, message});
    } catch (error) {
      return handleToolError("move_file", error);
    }
  },
);
