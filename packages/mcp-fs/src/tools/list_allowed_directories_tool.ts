import {returnSuccess} from "@jixo/mcp-core";
import * as s from "../schema.js";
import {state} from "../state.js";
import {registerTool} from "./server.js";

export const list_allowed_directories_tool = registerTool(
  "readonly",
  "list_allowed_directories",
  {
    description: `
Returns the list of root directories the server is sandboxed to. All file operations must be within these directories.

**AI Decision Guidance**:
- Call this tool first if you are unsure about the operating environment's boundaries or if you receive an 'AccessDeniedError'.
    `,
    inputSchema: s.ListAllowedDirectoriesArgsSchema,
    outputSuccessSchema: s.ListAllowedDirectoriesOutputSuccessSchema,
  },
  async () => {
    const directories = state.mountPoints.map((mp) => mp.realPath);
    const text =
      directories.length > 0
        ? `This server can only access files and directories within the following paths:\n- ${directories.join("\n- ")}`
        : "Warning: No directory restrictions are set. The server can access any path.";

    return {
      ...returnSuccess(text, {directories}),
      content: [{type: "text", text}],
    };
  },
);
