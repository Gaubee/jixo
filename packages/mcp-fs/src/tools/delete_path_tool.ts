import {returnSuccess} from "@jixo/mcp-core";
import fs from "node:fs";
import {DeleteNonEmptyDirectoryError} from "../error.js";
import {resolveAndValidatePath} from "../fs-utils/resolve-and-validate-path.js";
import {handleToolError} from "../handle-error.js";
import * as s from "../schema.js";
import {registerTool} from "./server.js";

export const delete_path_tool = registerTool(
  "readwrite",
  "delete_path",
  {
    description: `
Deletes a file or directory.

**AI DECISION GUIDANCE**:
- This is a destructive operation. Be certain before using it.
- To clear a directory's contents without deleting the directory itself, it is safer to 'list_directory', then 'delete_path' on each item.

**USAGE PATTERNS**:
- \`delete_path({ path: './temp/old-file.log' })\`
- \`delete_path({ path: '$B/dist', recursive: true })\`

**Usage Notes**:
- **Non-Empty Directories**: To delete a directory that contains files or other directories, you MUST set the 'recursive' parameter to 'true'.
- **Idempotency**: The tool will succeed even if the path does not exist, making it safe for cleanup scripts. It effectively ensures the path is gone.
    `,
    inputSchema: s.DeletePathArgsSchema,
    outputSuccessSchema: s.DeletePathSuccessSchema,
  },
  async ({path: targetPath, recursive = false}) => {
    try {
      const {validatedPath} = resolveAndValidatePath(targetPath, "write");

      if (!fs.existsSync(validatedPath)) {
        const message = `Successfully deleted ${targetPath} (path did not exist).`;
        return returnSuccess(message, {path: validatedPath, message});
      }

      fs.rmSync(validatedPath, {recursive, force: true});
      const message = `Successfully deleted ${targetPath}`;
      return returnSuccess(message, {path: validatedPath, message});
    } catch (error: any) {
      if (error.code?.includes("ENOTEMPTY") || error.code?.includes("EISDIR")) {
        return handleToolError("delete_path", new DeleteNonEmptyDirectoryError(`Path '${targetPath}' is a non-empty directory. Use the 'recursive: true' option.`));
      }
      return handleToolError("delete_path", error);
    }
  },
);
