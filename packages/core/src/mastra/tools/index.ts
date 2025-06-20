import {func_lazy, func_remember, map_get_or_put_async} from "@gaubee/util";
import type {ToolsInput} from "@mastra/core/agent";
import {createTool} from "@mastra/core/tools";
import {MCPClient} from "@mastra/mcp";
import {z} from "zod";
import {LogFileSchema, RoadmapTaskNodeSchema, WorkLogEntrySchema} from "../entities.js";
import {type LogManager} from "../services/logManager.js";

export const tools = {
  fileSystem: func_lazy(() => {
    const caches = new Map<string, ToolsInput>();
    return (dir: string) =>
      map_get_or_put_async(caches, dir, async () => {
        const client = new MCPClient({
          id: "fileSystem",
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
      id: "pnpm",
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
  git: func_remember(() => {
    const client = new MCPClient({
      id: "git",
      servers: {
        git: {
          command: "pnpm",
          args: ["mcp-git"],
        },
      },
    });
    return client.getTools().then((t) => {
      return t;
    });
  }),
  /**
   * Creates a set of tools that allow an agent to inspect the job's log file.
   * @param logManager The LogManager instance for the current job.
   * @returns An object containing tools for log inspection.
   */
  logTools: (logManager: LogManager): ToolsInput => ({
    getFullRoadmap: createTool({
      id: "getFullRoadmap",
      description:
        "Retrieves the entire current project roadmap. Use this ONLY when you need a complete overview of the project, for tasks like generating a summary report. For normal planning, the provided context is sufficient.",
      inputSchema: z.object({}),
      outputSchema: z.array(RoadmapTaskNodeSchema),
      execute: async () => {
        return logManager.getLogFile().roadmap;
      },
    }),
    getWorkLogHistory: createTool({
      id: "getWorkLogHistory",
      description:
        "Fetches a paginated history of the work log. Use this for tasks that require analyzing historical actions, like writing a weekly report or debugging a long chain of events. The `recentWorkLog` provided is usually enough.",
      inputSchema: z.object({
        page: z.number().optional().default(1),
        pageSize: z.number().optional().default(10),
      }),
      outputSchema: z.array(WorkLogEntrySchema),
      execute: async ({context}) => {
        const {page, pageSize} = context;
        const workLog = logManager.getLogFile().workLog;
        const start = (page - 1) * pageSize;
        const end = start + pageSize;
        return workLog.slice(start, end);
      },
    }),
    getFullLogFile: createTool({
      id: "getFullLogFile",
      description:
        "High-Cost Operation. Retrieves the entire raw log file data object. Use this ONLY as a last resort when a comprehensive, top-to-bottom analysis of the entire job history is absolutely necessary.",
      inputSchema: z.object({}),
      outputSchema: LogFileSchema,
      execute: async () => {
        return logManager.getLogFile();
      },
    }),
  }),
};
