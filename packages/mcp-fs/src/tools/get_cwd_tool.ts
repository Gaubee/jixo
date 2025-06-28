import {returnSuccess} from "@jixo/mcp-core";
import * as s from "../schema.js";
import {state} from "../state.js";
import {registerTool} from "./server.js";

export const get_cwd_tool = registerTool(
  "readonly",
  "fs_get_cwd",
  {
    description: "Returns the absolute path of the current working directory (CWD). Relative paths in other tool calls are resolved against this directory.",
    inputSchema: s.GetCwdArgsSchema,
    outputSuccessSchema: s.GetCwdOutputSuccessSchema,
  },
  async () => {
    return returnSuccess(`Current working directory is: ${state.cwd}`, {cwd: state.cwd});
  },
);
