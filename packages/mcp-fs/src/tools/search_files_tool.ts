import {returnSuccess} from "@jixo/mcp-core";
import {minimatch} from "minimatch";
import fs from "node:fs";
import path from "node:path";
import {resolveAndValidatePath} from "../fs-utils/resolve-and-validate-path.js";
import {handleToolError} from "../handle-error.js";
import * as s from "../schema.js";
import {registerTool} from "./server.js";

export const search_files_tool = registerTool(
  "readonly",
  "search_files",
  {
    description: `
Recursively search for files and directories whose names contain a given pattern, starting from a root path.

**AI DECISION GUIDANCE**:
- Use this when you need to find a file but don't know its exact location, or when you need to find all files of a certain type.
- This is more efficient than using 'list_directory' recursively and then filtering the results yourself.

**USAGE PATTERNS**:
- \`search_files({ path: '.', pattern: 'test' })\`
- \`search_files({ path: '$A', pattern: '.css', excludePatterns: ['node_modules'] })\`

**Usage Notes**:
- **Pattern**: The 'pattern' is a case-insensitive substring. It matches against the file or directory name, not the full path.
- **Exclusions**: The 'excludePatterns' parameter accepts an array of glob patterns (like 'node_modules' or '*.log') to prune the search, significantly speeding it up in large projects.
    `,
    inputSchema: s.SearchFilesArgsSchema,
    outputSuccessSchema: s.SearchFilesOutputSuccessSchema,
  },
  async ({path: rootPath, pattern, excludePatterns = []}) => {
    try {
      const {validatedPath: validRootPath} = resolveAndValidatePath(rootPath, "read");
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
