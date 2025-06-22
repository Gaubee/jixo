import {returnSuccess, safeRegisterTool2} from "@jixo/mcp-core";
import fs from "node:fs";
import {validatePath} from "../fs-utils/path-validation.js";
import {handleToolError} from "../handle-error.js";
import * as s from "../schema.js";
import {server} from "./server.js";

export const get_file_info_tool = safeRegisterTool2(
  server,
  "get_file_info",
  {
    description: "Retrieve detailed metadata about a file or directory (size, dates, permissions).",
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
