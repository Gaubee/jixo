import {func_lazy, func_remember, map_get_or_put_async} from "@gaubee/util";
import {experimental_createMCPClient as createMCPClient, tool, type ToolSet} from "ai";
import {Experimental_StdioMCPTransport} from "ai/mcp-stdio";
import z from "zod";
import {getAllPromptConfigs, getAllSkillMap} from "../../helper/prompts-loader.js";
import type {AiTask} from "../../helper/resolve-ai-tasks.js";

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
  pnpm: func_remember(async () => {
    const mcpClient = await createMCPClient({
      transport: new Experimental_StdioMCPTransport({
        command: "pnpx",
        args: ["@jixo/mcp-pnpm"],
      }),
    });
    const tools = await mcpClient.tools();
    return tools;
  }),
  sequentialThinking: func_remember(async () => {
    const mcpClient = await createMCPClient({
      transport: new Experimental_StdioMCPTransport({
        command: "pnpx",
        args: ["@modelcontextprotocol/server-sequential-thinking"],
      }),
    });
    const tools = await mcpClient.tools();
    return tools;
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

  jixo: func_lazy(() => {
    // const map = new Map<string, ToolSet>();
    const configs = getAllPromptConfigs();
    const allSkillMap = getAllSkillMap();
    return (ai_task: AiTask) => {
      return {
        get_jixo_skill: tool({
          description: "Get the JIXO skill prompt by name",
          parameters: z.object({
            name: z.string().describe("The name to get the skill for"),
          }),
          execute: async ({name}) => {
            if (name in allSkillMap) {
              return Reflect.get(configs, name);
            }
            return {type: "error", message: "Skill not found"};
          },
        }),
        ...(() => {
          // TODO:  use process shared lock-manager
          return {
            jixo_log_lock: tool({
              description: "Lock the log file for writing, will return log file content",
              parameters: z.object({}),
              execute: async () => {
                ai_task.reloadLog();
                return {type: "success", filepath: ai_task.log.filepath, content: ai_task.log.content};
              },
            }),
            jixo_log_unlock: tool({
              description: "Unlock the log file, for other locker can read the log file and then write.",
              parameters: z.object({}),
              execute: async () => {
                return {type: "success"};
              },
            }),
            jixo_tasks_exit: tool({
              description: "Exit the tasks.",
              parameters: z.object({
                code: z.number({description: "Exit code: 0 is Success; 1 is Error; 2 is No Tasks"}),
                reason: z.string({description: "Exit reasons that provide human-readable information"}),
              }),
              execute: async ({code, reason}) => {
                ai_task.exit(code, reason);
                return {type: "success"};
              },
            }),
          };
        })(),
      };
    };
  }),
};
