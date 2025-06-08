import {func_lazy, func_remember, map_get_or_put_async, obj_props} from "@gaubee/util";
import {experimental_createMCPClient as createMCPClient, tool, type ToolSet} from "ai";
import {Experimental_StdioMCPTransport} from "ai/mcp-stdio";
import z from "zod";
import {getPromptConfigs} from "../../helper/prompts-loader.js";

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
      return map_get_or_put_async(map, memory_filepath, async () => {
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

  jixoSkill: func_remember(() => {
    const configs = getPromptConfigs();
    const skills = obj_props(configs).filter((key) => key.endsWith(".skill"));
    const allSkillNavList = skills.reduce(
      (tree, skill) => {
        tree[skill] = configs[skill].content.split("\n")[0];
        return tree;
      },
      Object.create(null) as Record<string, string>,
    );
    return {
      allSkillNavList,
      tools: {
        get_jixo_skill: tool({
          description: "Get the JIXO skill prompt by name",
          parameters: z.object({
            name: z.string().describe("The name to get the skill for"),
          }),
          execute: async ({name}) => {
            if (name in allSkillNavList) {
              return Reflect.get(configs, name);
            }
            return {type: "error", message: "Skill not found"};
          },
        }),
      },
    };
  }),
};
