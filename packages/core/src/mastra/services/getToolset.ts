import {map_get_or_put} from "@gaubee/util";
import {createTool} from "@mastra/core";
import type {ToolsInput} from "@mastra/core/agent";
import z from "zod";
import {LogFileSchema, RoadmapTaskNodeSchema, WorkLogEntrySchema} from "../entities.js";
import type {LogManager} from "./logManager.js";

export const createLogManagerToolsets = (logManager: LogManager): ToolsInput => ({
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
});

const caches = new Map<LogManager, ToolsInput>();
export const getLogManagerToolsets = (logManager: LogManager): ToolsInput => {
  return map_get_or_put(caches, logManager, () => createLogManagerToolsets(logManager));
};
