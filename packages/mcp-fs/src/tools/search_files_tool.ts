import {returnSuccess, safeRegisterTool2} from "@jixo/mcp-core";
import {minimatch} from "minimatch";
import fs from "node:fs";
import path from "node:path";
import {validatePath} from "../fs-utils/path-validation.js";
import {handleToolError} from "../handle-error.js";
import * as s from "../schema.js";
import {server} from "./server.js";

export const search_files_tool = safeRegisterTool2(
  server,
  "search_files",
  {
    description: "Recursively search for files and directories matching a pattern within a given path.",
    inputSchema: s.SearchFilesArgsSchema,
    outputSuccessSchema: s.SearchFilesOutputSuccessSchema,
  },
  async ({path: rootPath, pattern, excludePatterns = []}) => {
    try {
      const validRootPath = validatePath(rootPath);
      const results: string[] = [];
      const searchQueue: string[] = [validRootPath];

      while (searchQueue.length > 0) {
        const currentPath = searchQueue.shift()!;
        const entries = fs.readdirSync(currentPath, {withFileTypes: true});

        for (const entry of entries) {
          const fullPath = path.join(currentPath, entry.name);
          const relativePath = path.relative(validRootPath, fullPath);

          const isExcluded = excludePatterns.some((p) => minimatch(relativePath, p, {dot: true}));
          if (isExcluded) continue;

          if (entry.name.toLowerCase().includes(pattern.toLowerCase())) {
            results.push(fullPath);
          }
          if (entry.isDirectory()) {
            searchQueue.push(fullPath);
          }
        }
      }
      const message = results.length > 0 ? results.join("\n") : `No matches found for "${pattern}" in "${rootPath}".`;
      return returnSuccess(message, {path: rootPath, pattern, matches: results});
    } catch (error) {
      return handleToolError("search_files", error);
    }
  },
);
