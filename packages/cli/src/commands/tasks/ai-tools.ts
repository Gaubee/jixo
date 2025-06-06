import {func_lazy, func_remember, map_get_or_put_async} from "@gaubee/util";
import {experimental_createMCPClient as createMCPClient, type ToolSet} from "ai";
import {Experimental_StdioMCPTransport} from "ai/mcp-stdio";

export const tools = {
  fileSystem: func_lazy(() => {
    const map = new Map<string, ToolSet>();
    return (cwd: string) => {
      return map_get_or_put_async(map, cwd, async () => {
        const mcpClient = await createMCPClient({
          transport: new Experimental_StdioMCPTransport({
            command: "pnpx",
            args: ["@modelcontextprotocol/server-filesystem", cwd],
          }),
        });
        const tools = await mcpClient.tools();
        return tools;
      });
    };
  }),
  memory: func_lazy(() => {
    const map = new Map<string, ToolSet>();
    return (memory_filepath: string) => {
      map_get_or_put_async(map, memory_filepath, async () => {
        const mcpClient = await createMCPClient({
          transport: new Experimental_StdioMCPTransport({
            command: "pnpx",
            args: ["@modelcontextprotocol/server-memory"],
            env: {
              MEMORY_FILE_PATH: memory_filepath,
            },
          }),
        });
        const tools = await mcpClient.tools();
        return tools;
      });
    };
  }),
  fetch: func_remember(async () => {
    const mcpClient = await createMCPClient({
      transport: new Experimental_StdioMCPTransport({
        command: "uvx",
        args: ["mcp-server-fetch"],
      }),
    });
    const tools = await mcpClient.tools();
    return tools;
  }),
  git: func_lazy(() => {
    const map = new Map<string, ToolSet>();

    return (repo: string) => {
      return map_get_or_put_async(map, repo, async () => {
        const mcpClient = await createMCPClient({
          transport: new Experimental_StdioMCPTransport({
            command: "uvx",
            args: ["mcp-server-git", "--repository", repo],
          }),
        });
        const tools = await mcpClient.tools();
        return tools;
      });
    };
  }),
};
