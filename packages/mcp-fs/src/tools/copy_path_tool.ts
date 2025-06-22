import {returnSuccess, safeRegisterTool2} from "@jixo/mcp-core";
import fs from "node:fs";
import {validatePath} from "../fs-utils/path-validation.js";
import {handleToolError} from "../handle-error.js";
import * as s from "../schema.js";
import {server} from "./server.js";

export const copy_path_tool = safeRegisterTool2(
  server,
  "copy_path",
  {
    description: "Copies a file or directory. Requires `recursive: true` to copy directories.",
    inputSchema: s.CopyPathArgsSchema,
    outputSuccessSchema: s.CommonSuccessMsgSchema,
  },
  async ({source, destination, recursive = false}) => {
    try {
      const validSource = validatePath(source);
      const validDest = validatePath(destination);
      const stats = fs.statSync(validSource);
      if (stats.isDirectory() && !recursive) {
        throw new Error("Source is a directory, but 'recursive' option is not set to true. Aborting to prevent incomplete copy.");
      }
      fs.cpSync(validSource, validDest, {recursive: recursive});
      const message = `Successfully copied ${source} to ${destination}`;
      return returnSuccess(message, {source: validSource, destination: validDest, message});
    } catch (error) {
      return handleToolError("copy_path", error);
    }
  },
);
