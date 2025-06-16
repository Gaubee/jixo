import {z} from "zod";

// Use z.lazy for recursive schemas. This defines a single node in the Roadmap tree.
const RoadmapTaskNodeBase = z.object({
  id: z.string(),
  description: z.string(),
  // Added "Cancelled" to be compliant with the state machine in system.md
  status: z.enum(["Pending", "Locked", "Completed", "Failed", "Cancelled"]),
  runner: z.string().optional(),
});
type RoadmapTaskNodeBaseType = z.infer<typeof RoadmapTaskNodeBase>;
export type RoadmapTaskNodeData = RoadmapTaskNodeBaseType & {
  children?: RoadmapTaskNodeData[];
};
export const RoadmapTaskNodeSchema: z.ZodType<RoadmapTaskNodeData> = RoadmapTaskNodeBase.extend({
  // The "children" field is optional, but if present, it must be an array of RoadmapTaskNodeSchema.
  children: z.array(z.lazy(() => RoadmapTaskNodeBase)).optional(),
});

// Verified against system.md specification.
// The "Result" can be pending if a task is paused.
export const WorkLogEntrySchema = z.object({
  timestamp: z.string().datetime(),
  runnerId: z.string(),
  role: z.enum(["Planner", "Runner"]),
  objective: z.string(),
  result: z.enum(["Succeeded", "Failed", "Pending"]), // 'Cancelled' applies to a Task's status, not a work log result. A planner might cancel a task, logging that as a Succeeded planning action.
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
