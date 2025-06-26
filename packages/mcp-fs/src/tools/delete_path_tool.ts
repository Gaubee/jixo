import {returnSuccess} from "@jixo/mcp-core";
import fs from "node:fs";
import {DeleteNonEmptyDirectoryError, PermissionDeniedError} from "../error.js";
import {validatePath} from "../fs-utils/path-validation.js";
import {handleToolError} from "../handle-error.js";
import * as s from "../schema.js";
import {registerTool} from "./server.js";

export const delete_path_tool = registerTool(
  "readwrite",
  "delete_path",
  {
    description: `
Deletes a file or directory.

**AI Decision Guidance**:
- This is a destructive operation. Be certain before using it.
- To clear a directory's contents without deleting the directory itself, it is safer to 'list_directory', then 'delete_path' on each item.

**Usage Notes**:
- **Non-Empty Directories**: To delete a directory that contains files or other directories, you MUST set the 'recursive' parameter to 'true'.
- **Idempotency**: The tool will succeed even if the path does not exist, making it safe for cleanup scripts. It effectively ensures the path is gone.
    `,
    inputSchema: s.DeletePathArgsSchema,
    outputSuccessSchema: s.DeletePathSuccessSchema,
  },
  async ({path: targetPath, recursive = false}) => {
    try {
      let validPath: string;
      try {
        // Validate the path exists and is accessible.
        validPath = validatePath(targetPath);
      } catch (error) {
        // If permission is denied, re-throw immediately.
        if (error instanceof PermissionDeniedError) {
          throw error;
        }
        // For other errors (like file not found), we treat it as a success for idempotency.
        // We must return a valid ToolResult object.
        const message = `Successfully deleted ${targetPath} (path did not exist).`;
        return returnSuccess(message, {path: targetPath, message});
      }

      // If validation succeeded, proceed with deletion.
      fs.rmSync(validPath, {recursive, force: true});
      const message = `Successfully deleted ${targetPath}`;
      return returnSuccess(message, {path: validPath, message});
    } catch (error: any) {
      if (error.code?.includes("ENOTEMPTY") || error.code?.includes("EISDIR")) {
        return handleToolError("delete_path", new DeleteNonEmptyDirectoryError(`Path '${targetPath}' is a non-empty directory. Use the 'recursive: true' option.`));
      }
      return handleToolError("delete_path", error);
    }
  },
);
