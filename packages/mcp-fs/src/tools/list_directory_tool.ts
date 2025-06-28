import {returnSuccess} from "@jixo/mcp-core";
import fs from "node:fs";
import path from "node:path";
import {NotADirectoryError} from "../error.js";
import {resolveAndValidatePath} from "../fs-utils/resolve-and-validate-path.js";
import {handleToolError} from "../handle-error.js";
import * as s from "../schema.js";
import {registerTool} from "./server.js";

type DirectoryEntry = {
  name: string;
  type: "file" | "directory";
  children?: DirectoryEntry[];
};

export const list_directory_tool = registerTool(
  "readonly",
  "list_directory",
  {
    description: `
Get a listing of files and subdirectories within a specified directory.

**AI Decision Guidance**:
- This is your primary tool for exploring the file system structure.
- Use it to discover files before reading them or to understand a project's layout.
- For finding files by name across a deep hierarchy, 'search_files' might be more efficient.

**Usage Notes**:
- **Recursion**: By default, this tool performs a flat listing (depth of 1). To get a nested tree structure, set the 'maxDepth' parameter to a value greater than 1. This is useful for quickly understanding the layout of an entire directory.
    `,
    inputSchema: s.ListDirectoryArgsSchema,
    outputSuccessSchema: s.ListDirectoryOutputSuccessSchema,
  },
  async ({path: rootPath, maxDepth = 1}) => {
    try {
      const {validatedPath} = resolveAndValidatePath(rootPath, "read");

      if (!fs.statSync(validatedPath).isDirectory()) {
        throw new NotADirectoryError(`Path is not a directory: ${rootPath}`);
      }

      const listRecursively = (dir: string, currentDepth: number): DirectoryEntry[] => {
        if (currentDepth >= maxDepth) return [];
        try {
          const entries = fs.readdirSync(dir, {withFileTypes: true});
          return entries.map((entry) => {
            const entryPath = path.join(dir, entry.name);
            const isDirectory = entry.isDirectory();
            const result: DirectoryEntry = {
              name: entry.name,
              type: isDirectory ? "directory" : "file",
            };
            if (isDirectory) {
              result.children = listRecursively(entryPath, currentDepth + 1);
            }
            return result;
          });
        } catch {
          return [];
        }
      };

      const formatTree = (entries: DirectoryEntry[], prefix: string): string => {
        let treeString = "";
        for (let i = 0; i < entries.length; i++) {
          const entry = entries[i];
          const connector = i === entries.length - 1 ? "└── " : "├── ";
          treeString += `${prefix}${connector}${entry.name}${entry.type === "directory" ? "/" : ""}\n`;
          if (entry.children?.length) {
            const newPrefix = prefix + (i === entries.length - 1 ? "    " : "│   ");
            treeString += formatTree(entry.children, newPrefix);
          }
        }
        return treeString;
      };

      const structuredEntries = listRecursively(validatedPath, 0);

      if (structuredEntries.length === 0) {
        const message = `Directory '${rootPath}' is empty or could not be read.`;
        return returnSuccess(message, {path: validatedPath, entries: []});
      }

      const formattedText =
        maxDepth === 1
          ? structuredEntries.map((e) => e.name + (e.type === "directory" ? "/" : "")).join("\n")
          : `${path.basename(validatedPath)}\n${formatTree(structuredEntries, "")}`;

      return {
        ...returnSuccess(formattedText, {path: validatedPath, entries: structuredEntries}),
        content: [{type: "text", text: formattedText}],
      };
    } catch (error: any) {
      if (error.code === "ENOTDIR") {
        return handleToolError("list_directory", new NotADirectoryError(`Path is not a directory: ${rootPath}`));
      }
      return handleToolError("list_directory", error);
    }
  },
);
