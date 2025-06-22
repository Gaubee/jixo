import {returnSuccess, safeRegisterTool2} from "@jixo/mcp-core";
import fs from "node:fs";
import path from "node:path";
import {AccessDeniedError, DeleteNonEmptyDirectoryError} from "../error.js";
import {config} from "../fs-utils/config.js";
import {expandHome} from "../fs-utils/path-validation.js";
import {handleToolError} from "../handle-error.js";
import * as s from "../schema.js";
import {server} from "./server.js";

export const delete_path_tool = safeRegisterTool2(
  server,
  "delete_path",
  {
    description: "Deletes a file or directory. Requires `recursive: true` to delete non-empty directories. Is idempotent (succeeds if path already does not exist).",
    inputSchema: s.DeletePathArgsSchema,
    outputSuccessSchema: s.DeletePathSuccessSchema,
  },
  async ({path: targetPath, recursive = false}) => {
    try {
      const expandedPath = expandHome(targetPath);
      const absolutePath = path.isAbsolute(expandedPath) ? path.resolve(expandedPath) : path.resolve(process.cwd(), expandedPath);
      const validPath = path.normalize(absolutePath);

      if (config.allowedDirectories.length > 0 && !config.allowedDirectories.some((dir) => validPath.startsWith(dir))) {
        throw new AccessDeniedError(`Access denied: Path '${validPath}' is outside the allowed directories.`);
      }

      fs.rmSync(validPath, {recursive: recursive, force: true});
      const message = `Successfully deleted ${targetPath}`;
      return returnSuccess(message, {path: validPath, message});
    } catch (error: any) {
      if (error.code?.includes("ENOTEMPTY") || error.code?.includes("EISDIR")) {
        return handleToolError("delete_path", new DeleteNonEmptyDirectoryError(`Path '${targetPath}' is a non-empty directory. Use the 'recursive: true' option.`));
      }
      return handleToolError("delete_path", error);
    }
  },
);
