import {logger, returnSuccess} from "@jixo/mcp-core";
import fs from "node:fs";
import {InvalidOperationError} from "../error.js";
import {resolveAndValidatePath} from "../fs-utils/resolve-and-validate-path.js";
import {handleToolError} from "../handle-error.js";
import * as s from "../schema.js";
import {registerTool} from "./server.js";

export const write_file_tool = registerTool(
  "readwrite",
  "write_file",
  {
    description: `
Create a new file with specified content, or completely overwrite an existing file.

**AI Decision Guidance**:
- **DANGER**: This tool is destructive. If the file exists, its entire content will be replaced. There is no undo.
- Use this for creating new files (e.g., 'index.html', 'new_component.tsx') or for resetting a file to a known state.
- For making targeted changes to an existing file, it is MUCH SAFER to use the 'edit_file' tool.
    `,
    inputSchema: s.WriteFileArgsSchema,
    outputSuccessSchema: s.WriteFileSuccessSchema,
  },
  async ({path, content}) => {
    try {
      const {validatedPath} = resolveAndValidatePath(path, "write");
      fs.writeFileSync(validatedPath, content, "utf-8");
      const message = `Successfully wrote to ${validatedPath}`;
      logger.log("write_file", message);
      return returnSuccess(message, {path: validatedPath, message});
    } catch (error: any) {
      if (error.code === "EISDIR") {
        return handleToolError("write_file", new InvalidOperationError(`Cannot write to '${path}', it is a directory.`));
      }
      return handleToolError("write_file", error);
    }
  },
);
