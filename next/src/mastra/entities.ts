import {z} from "zod";

// Base schema without recursion for clean type inference.
const RoadmapTaskNodeBaseSchema = z.object({
  id: z.string(),
  title: z.string(), // Title is now the required, concise identifier for a task.
  description: z.string().optional(), // General description is now optional.
  details: z.string().optional(), // Detailed, step-by-step instructions for the executor.
  // A task now enters 'PendingReview' after execution.
  status: z.enum(["Pending", "Locked", "Completed", "Failed", "Cancelled", "PendingReview"]),
  executor: z.string().optional(),
  reviewer: z.string().optional(), // The ID of the reviewer for this task.
  dependsOn: z.array(z.string()).optional(), // IDs of tasks that must be completed first.
  tags: z.array(z.string()).optional(), // For categorization and specialized routing.
  gitCommit: z.union([z.boolean(), z.string()]).optional(), // Instruction for git commit after execution.
});
type RoadmapTaskNodeBaseData = z.infer<typeof RoadmapTaskNodeBaseSchema>;

// The `children` property is optional in the type definition to align with the schema.
export type RoadmapTaskNodeData = RoadmapTaskNodeBaseData & {
  children: RoadmapTaskNodeData[];
};

// Per your direction, the schema remains as you've defined it.
export const RoadmapTaskNodeSchema: z.ZodType<RoadmapTaskNodeData> = RoadmapTaskNodeBaseSchema.extend({
  children: z.lazy(() => z.array(RoadmapTaskNodeSchema)),
});

export const WorkLogEntrySchema = z.object({
  timestamp: z.string().datetime(),
  runnerId: z.string(), // This remains runnerId for the generic process ID.
  role: z.enum(["Planner", "Executor", "Reviewer"]), // Role enum expanded
  objective: z.string(),
  result: z.enum(["Succeeded", "Failed", "Pending"]),
  summary: z.string(),
});
export type WorkLogEntryData = z.infer<typeof WorkLogEntrySchema>;

export const LogFileSchema = z.object({
  title: z.string(),
  progress: z.string(),
  roadmap: z.array(RoadmapTaskNodeSchema).optional().default([]),
  workLog: z.array(WorkLogEntrySchema).optional().default([]),
});
export type LogFileData = z.infer<typeof LogFileSchema>;

export const DELETE_FIELD_MARKER = "<!--DELETE-->";
