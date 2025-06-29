import {returnSuccess} from "@jixo/mcp-core";
import fs from "node:fs";
import {FileNotFoundError} from "../error.js";
import {resolveAndValidatePath} from "../fs-utils/resolve-and-validate-path.js";
import {handleToolError} from "../handle-error.js";
import * as s from "../schema.js";
import {registerTool} from "./server.js";

export const move_file_tool = registerTool(
  "readwrite",
  "move_file",
  {
    description: `
Move or rename a file or directory.

**AI DECISION GUIDANCE**:
- Use this for renaming a file/directory in its current location or for moving it to a different directory.
- This is an efficient operation that just changes filesystem pointers.
- To create a copy of a file, use 'copy_path' instead.

**USAGE PATTERNS**:
- \`move_file({ source: './old-name.txt', destination: './new-name.txt' })\`
- \`move_file({ source: './file.txt', destination: './archive/' })\`
    `,
    inputSchema: s.MoveFileArgsSchema,
    outputSuccessSchema: s.MoveFileSuccessSchema,
  },
  async ({source, destination}) => {
    try {
      // Moving requires write access to the source (to delete it) and the destination (to create it).
      const {validatedPath: validSource} = resolveAndValidatePath(source, "write");
      const {validatedPath: validDest} = resolveAndValidatePath(destination, "write");
      fs.renameSync(validSource, validDest);
      const message = `Successfully moved ${source} to ${destination}`;
      return returnSuccess(message, {source: validSource, destination: validDest, message});
    } catch (error: any) {
      if (error.code === "ENOENT") {
        return handleToolError("move_file", new FileNotFoundError(`Source path not found: ${source}`));
      }
      return handleToolError("move_file", error);
    }
  },
);
