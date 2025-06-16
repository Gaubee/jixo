import {z} from "zod";

// Base schema without recursion for clean type inference.
const RoadmapTaskNodeBaseSchema = z.object({
  id: z.string(),
  description: z.string(),
  status: z.enum(["Pending", "Locked", "Completed", "Failed", "Cancelled"]),
  runner: z.string().optional(),
});
type RoadmapTaskNodeBaseData = z.infer<typeof RoadmapTaskNodeBaseSchema>;

// Final recursive type and schema.
export type RoadmapTaskNodeData = RoadmapTaskNodeBaseData & {
  children: RoadmapTaskNodeData[];
};

export const RoadmapTaskNodeSchema: z.ZodType<RoadmapTaskNodeData> = RoadmapTaskNodeBaseSchema.extend({
  // The recursive part now correctly points to the full schema.
  // We also default children to an empty array for consistency.
  children: z.lazy(() => z.array(RoadmapTaskNodeSchema)),
  // .optional()
  /**<!--[[
   * 你这里写了 default 并不能对冲 optional ，所以 RoadmapTaskNodeData 那边的 children仍然要写成`?:`。
   * 要注意，这里的 default 只是 optional+注释 的 一个功能而已。
   * ]]--> */
  // .default([]),
});

// Verified against system.md specification.
export const WorkLogEntrySchema = z.object({
  timestamp: z.string().datetime(),
  runnerId: z.string(),
  role: z.enum(["Planner", "Runner"]),
  objective: z.string(),
  result: z.enum(["Succeeded", "Failed", "Pending"]),
  summary: z.string(),
});
export type WorkLogEntryData = z.infer<typeof WorkLogEntrySchema>;

// The top-level schema for the entire *.log.md file
export const LogFileSchema = z.object({
  title: z.string(),
  progress: z.string(),
  // The roadmap is now an array of root-level task nodes.
  roadmap: z.array(RoadmapTaskNodeSchema).optional().default([]),
  workLog: z.array(WorkLogEntrySchema).optional().default([]),
});
export type LogFileData = z.infer<typeof LogFileSchema>;

// A special value to signal field deletion in update operations
export const DELETE_FIELD_MARKER = "<!--DELETE-->";
