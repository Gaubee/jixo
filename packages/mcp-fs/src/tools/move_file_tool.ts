import {returnSuccess} from "@jixo/mcp-core";
import fs from "node:fs";
import {validatePath} from "../fs-utils/path-validation.js";
import {handleToolError} from "../handle-error.js";
import * as s from "../schema.js";
import {registerTool} from "./server.js";

export const move_file_tool = registerTool(
  "readwrite",
  "move_file",
  {
    description: `
Move or rename a file or directory.

**AI Decision Guidance**:
- Use this tool for renaming a file/directory in its current location or for moving it to a different directory.
- This is an efficient operation that just changes filesystem pointers.
- To create a copy of a file, use 'copy_path' instead.
    `,
    inputSchema: s.MoveFileArgsSchema,
    outputSuccessSchema: s.MoveFileSuccessSchema,
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
