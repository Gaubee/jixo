import {returnSuccess, safeRegisterTool2} from "@jixo/mcp-core";
import {config} from "../fs-utils/config.js";
import * as s from "../schema.js";
import {server} from "./server.js";

export const list_allowed_directories_tool = safeRegisterTool2(
  server,
  "list_allowed_directories",
  {
    description: "Returns the list of root directories the server is allowed to access.",
    inputSchema: s.ListAllowedDirectoriesArgsSchema,
    outputSuccessSchema: s.ListAllowedDirectoriesOutputSuccessSchema,
  },
  async () => {
    const text =
      config.allowedDirectories.length > 0
        ? `This server can only access files and directories within the following paths:\n- ${config.allowedDirectories.join("\n- ")}`
        : "Warning: No directory restrictions are set. The server can access any path.";

    return {
      ...returnSuccess(text, {directories: config.allowedDirectories}),
      content: [{type: "text", text}],
    };
  },
);
