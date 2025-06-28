import {returnSuccess} from "@jixo/mcp-core";
import * as s from "../schema.js";
import {state} from "../state.js";
import {registerTool} from "./server.js";

export const list_mounts_tool = registerTool(
  "readonly",
  "fs_list_mounts",
  {
    description: "Lists all configured mount points, including their drive letters, paths, and permissions. Also shows the current working directory (CWD).",
    inputSchema: s.ListMountsArgsSchema,
    outputSuccessSchema: s.ListMountsOutputSuccessSchema,
  },
  async () => {
    const mounts = state.mountPoints.map((mp) => ({
      drive: mp.drive ? `$${mp.drive}` : undefined,
      path: mp.realPath,
      permissions: mp.permissions.flag,
    }));
    const message = `CWD: ${state.cwd}\nMounts:\n${mounts.map((m) => `- [${m.permissions}] ${m.drive ?? "(no drive)"}: ${m.path}`).join("\n")}`;

    return returnSuccess(message, {mounts, cwd: state.cwd});
  },
);
