import {returnSuccess, safeRegisterTool2} from "@jixo/mcp-core";
import fs from "node:fs";
import path from "node:path";
import {validatePath} from "../fs-utils/path-validation.js";
import {handleToolError} from "../handle-error.js";
import * as s from "../schema.js";
import {server} from "./server.js";

type DirectoryEntry = {
  name: string;
  type: "file" | "directory";
  children?: DirectoryEntry[];
};

export const list_directory_tool = safeRegisterTool2(
  server,
  "list_directory",
  {
    description: "Get a listing of files and directories. Can list recursively to show a directory tree.",
    inputSchema: s.ListDirectoryArgsSchema,
    outputSuccessSchema: s.ListDirectoryOutputSuccessSchema,
  },
  async ({path: rootPath, maxDepth = 1}) => {
    try {
      const validPath = validatePath(rootPath);

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
          return []; // Ignore errors reading subdirectories
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

      const structuredEntries = listRecursively(validPath, 0);

      if (structuredEntries.length === 0) {
        const message = `Directory '${rootPath}' is empty or could not be read.`;
        return returnSuccess(message, {path: validPath, entries: []});
      }

      const formattedText =
        maxDepth === 1
          ? structuredEntries.map((e) => e.name + (e.type === "directory" ? "/" : "")).join("\n")
          : `${path.basename(validPath)}\n${formatTree(structuredEntries, "")}`;

      return {
        ...returnSuccess(formattedText, {path: validPath, entries: structuredEntries}),
        content: [{type: "text", text: formattedText}],
      };
    } catch (error) {
      return handleToolError("list_directory", error);
    }
  },
);
