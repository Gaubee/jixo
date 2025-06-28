import {returnSuccess} from "@jixo/mcp-core";
import fs from "node:fs";
import {NotADirectoryError} from "../error.js";
import {resolveAndValidatePath} from "../fs-utils/resolve-and-validate-path.js";
import {handleToolError} from "../handle-error.js";
import * as s from "../schema.js";
import {state} from "../state.js";
import {registerTool} from "./server.js";

export const set_cwd_tool = registerTool(
  "readwrite",
  "fs_set_cwd",
  {
    description: "Sets the current working directory (CWD) to a new path. The path must be a directory. All subsequent relative paths will be resolved from this new CWD.",
    inputSchema: s.SetCwdArgsSchema,
    outputSuccessSchema: s.SetCwdSuccessSchema,
  },
  async ({path}) => {
    try {
      const {validatedPath} = resolveAndValidatePath(path, "read");
      const stats = fs.statSync(validatedPath);
      if (!stats.isDirectory()) {
        throw new NotADirectoryError(`Path '${path}' is not a directory.`);
      }
      state.cwd = validatedPath;
      const message = `Current working directory changed to: ${validatedPath}`;
      return returnSuccess(message, {newCwd: validatedPath, message});
    } catch (error) {
      return handleToolError("fs_set_cwd", error);
    }
  },
);
