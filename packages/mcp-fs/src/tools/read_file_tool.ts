import {returnSuccess} from "@jixo/mcp-core";
import fs from "node:fs";
import {FileNotFoundError} from "../error.js";
import {resolveAndValidatePath} from "../fs-utils/resolve-and-validate-path.js";
import {handleToolError} from "../handle-error.js";
import * as s from "../schema.js";
import {registerTool} from "./server.js";

export const read_file_tool = registerTool(
  "readonly",
  "read_file",
  {
    description: `
Read the complete contents of a single file into a string.

**AI Decision Guidance**:
- This is the primary tool for inspecting the content of text-based files like source code, configuration files, or documents.
- Before calling this, you might want to use 'list_directory' to confirm the file exists.
    `,
    inputSchema: s.ReadFileArgsSchema,
    outputSuccessSchema: s.ReadFileOutputSuccessSchema,
  },
  async ({path}) => {
    try {
      const {validatedPath} = resolveAndValidatePath(path, "read");
      const content = fs.readFileSync(validatedPath, "utf-8");
      return returnSuccess(content, {path: validatedPath, content});
    } catch (error: any) {
      if (error.code === "ENOENT") {
        return handleToolError("read_file", new FileNotFoundError(`File not found at path: ${path}`));
      }
      return handleToolError("read_file", error);
    }
  },
);
