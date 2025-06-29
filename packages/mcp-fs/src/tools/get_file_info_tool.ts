import {returnSuccess} from "@jixo/mcp-core";
import fs from "node:fs";
import {FileNotFoundError} from "../error.js";
import {resolveAndValidatePath} from "../fs-utils/resolve-and-validate-path.js";
import {handleToolError} from "../handle-error.js";
import * as s from "../schema.js";
import {registerTool} from "./server.js";

export const get_file_info_tool = registerTool(
  "readonly",
  "get_file_info",
  {
    description: `
Retrieve detailed metadata about a specific file or directory.

**AI DECISION GUIDANCE**:
- Use this to check if a path exists and what it is (a file or a directory) before attempting an operation like 'read_file' or 'list_directory'.
- Useful for getting the last modification date to see if a file is stale.

**USAGE PATTERNS**:
- \`get_file_info({ path: './package.json' })\`
- \`get_file_info({ path: '$A/src' })\`
    `,
    inputSchema: s.GetFileInfoArgsSchema,
    outputSuccessSchema: s.FileInfoOutputSuccessSchema,
  },
  async ({path}) => {
    try {
      const {validatedPath} = resolveAndValidatePath(path, "read");
      let stats: fs.Stats;
      try {
        stats = fs.statSync(validatedPath);
      } catch (e: any) {
        if (e.code === "ENOENT") {
          throw new FileNotFoundError(`File or directory not found at path: ${path}`);
        }
        throw e;
      }
      const info = {
        path: validatedPath,
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
