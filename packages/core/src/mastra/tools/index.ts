import {func_lazy, func_remember, map_get_or_put_async} from "@gaubee/util";
import type {ToolsInput} from "@mastra/core/agent";
import {MCPClient} from "@mastra/mcp";
import {getLogManagerToolsets} from "../services/getToolset.js";
import {nodejsToolsets} from "./nodejs_tools.js";

export const tools = {
  fileSystem: func_lazy(() => {
    const caches = new Map<string, ToolsInput>();
    return (dir: string) =>
      map_get_or_put_async(caches, dir, async () => {
        const client = new MCPClient({
          servers: {
            fs: {
              command: "pnpm",
              args: ["mcp-fs", dir, "-L"],
            },
          },
        });
        return client.getTools();
      });
  }),
  pnpm: func_remember(() => {
    const client = new MCPClient({
      servers: {
        pnpm: {
          command: "pnpm",
          args: ["mcp-pnpm"],
        },
      },
    });
    return client.getTools().then((t) => {
      return t;
    });
  }),
  git: func_lazy(() => {
    const caches = new Map<string | undefined, ToolsInput>();
    return (dir?: string) =>
      map_get_or_put_async(caches, dir, async () => {
        const client = new MCPClient({
          servers: {
            git: {
              command: "pnpm",
              args: dir ? ["mcp-git", "--repository", dir, "-L"] : ["mcp-git", "-L"],
            },
          },
        });
        return client.getTools();
      });
  }),
  /**
   * Creates a set of tools that allow an agent to inspect the job's log file.
   * @param logManager The LogManager instance for the current job.
   * @returns An object containing tools for log inspection.
   */
  logTools: getLogManagerToolsets,
  node: nodejsToolsets,
};
