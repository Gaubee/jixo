import {returnSuccess} from "@jixo/mcp-core";
import fs from "node:fs";
import {validatePath} from "../fs-utils/path-validation.js";
import {handleToolError} from "../handle-error.js";
import * as s from "../schema.js";
import {registerTool} from "./server.js";

export const get_file_info_tool = registerTool(
  "readonly",
  "get_file_info",
  {
    description: `
Retrieve detailed metadata about a specific file or directory, such as its size, type, modification date, and permissions.

**AI Decision Guidance**:
- Use this tool to check if a path exists and what it is (a file or a directory) before attempting an operation like 'read_file' or 'list_directory'.
- Useful for getting the last modification date to see if a file is stale.
    `,
    inputSchema: s.GetFileInfoArgsSchema,
    outputSuccessSchema: s.FileInfoOutputSuccessSchema,
  },
  async ({path}) => {
    try {
      const validPath = validatePath(path);
      const stats = fs.statSync(validPath);
      const info = {
        path: validPath,
        type: (stats.isDirectory() ? "directory" : stats.isFile() ? "file" : "other") as "file" | "directory" | "other",
        size: stats.size,
        permissions: (stats.mode & 0o777).toString(8),
        created: stats.birthtime.toISOString(),
        modified: stats.mtime.toISOString(),
      };
      const formatted = Object.entries(info)
        .map(([key, value]) => `${key}: ${value}`)
        .join("\n");
      return {
        ...returnSuccess(formatted, info),
        content: [{type: "text", text: formatted}],
      };
    } catch (error) {
      return handleToolError("get_file_info", error);
    }
  },
);
