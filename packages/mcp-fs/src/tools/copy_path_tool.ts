import {returnSuccess} from "@jixo/mcp-core";
import fs from "node:fs";
import {InvalidOperationError} from "../error.js";
import {resolveAndValidatePath} from "../fs-utils/resolve-and-validate-path.js";
import {handleToolError} from "../handle-error.js";
import * as s from "../schema.js";
import {registerTool} from "./server.js";

export const copy_path_tool = registerTool(
  "readwrite",
  "copy_path",
  {
    description: `
Copies a file or a directory to a new location.

**AI Decision Guidance**:
- Use this tool to duplicate files or entire project structures.
- To rename or move a file without duplicating it, use 'move_file' instead, which is more efficient.
- This tool cannot be used to overwrite a file with itself.

**Usage Notes**:
- **Directories**: To copy a directory and all its contents, you MUST set the 'recursive' parameter to 'true'. Failing to do so for a directory will result in an error.
- **Destination**: If the 'destination' path ends with a directory separator ('/' or '\\') or already exists as a directory, the source will be copied *inside* it. Otherwise, the source will be copied and renamed to the destination name.
    `,
    inputSchema: s.CopyPathArgsSchema,
    outputSuccessSchema: s.CopyPathSuccessSchema,
  },
  async ({source, destination, recursive = false}) => {
    try {
      const {validatedPath: validSource} = resolveAndValidatePath(source, "read");
      const {validatedPath: validDest} = resolveAndValidatePath(destination, "write");
      const stats = fs.statSync(validSource);
      if (stats.isDirectory() && !recursive) {
        throw new InvalidOperationError("Source is a directory, but 'recursive' option is not set to true. Aborting to prevent incomplete copy.");
      }
      fs.cpSync(validSource, validDest, {recursive: recursive});
      const message = `Successfully copied ${source} to ${destination}`;
      return returnSuccess(message, {source: validSource, destination: validDest, message});
    } catch (error: any) {
      if (error.code === "ERR_FS_CP_EINVAL" || error.code === "EEXIST") {
        return handleToolError("copy_path", new InvalidOperationError(error.message));
      }
      return handleToolError("copy_path", error);
    }
  },
);
