import {func_lazy, func_remember, map_get_or_put_async} from "@gaubee/util";
import type {ToolsInput} from "@mastra/core/agent";
import {MCPClient} from "@mastra/mcp";

export const tools = {
  fileSystem: func_lazy(() => {
    const caches = new Map<string, ToolsInput>();
    return (dir: string) =>
      map_get_or_put_async(caches, dir, async () => {
        const client = new MCPClient({
          servers: {
            fs: {
              command: "pnpm",
              args: ["mcp-fs", dir],
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
    return client.getTools();
  }),
  git: func_lazy(() => {
    const caches = new Map<string, ToolsInput>();
    return (repo: string) => {
      return map_get_or_put_async(caches, repo, async () => {
        const client = new MCPClient({
          servers: {
            git: {
              command: "uvx",
              args: ["mcp-server-git", "--repository", repo],
            },
          },
        });
        const tools = await client.getTools();
        return tools;
      });
    };
  }),
};
