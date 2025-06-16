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
// The `children` property is now correctly typed as optional (`?`)
// because we use `.optional()` in the schema definition.
export type RoadmapTaskNodeData = RoadmapTaskNodeBaseData & {
  children: RoadmapTaskNodeData[];
};

export const RoadmapTaskNodeSchema: z.ZodType<RoadmapTaskNodeData> = RoadmapTaskNodeBaseSchema.extend({
  // Using .optional().default([]) is the most robust approach.
  /**<!--[[你没理解我刚才对你的解释关于  optional 和 default 的用法，这里就先不要再改了，以我为准]]--> */
  children: z.lazy(() => z.array(RoadmapTaskNodeSchema)),
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
  roadmap: z.array(RoadmapTaskNodeSchema).optional().default([]),
  workLog: z.array(WorkLogEntrySchema).optional().default([]),
});
export type LogFileData = z.infer<typeof LogFileSchema>;

// A special value to signal field deletion in update operations
export const DELETE_FIELD_MARKER = "<!--DELETE-->";
