import {z} from "zod";
export const RoadmapTaskSchema = z.object({
  id: z.string(),
  description: z.string(),
  status: z.enum(["Pending", "Locked", "Completed", "Failed", "Cancelled"]),
  runner: z.string().optional(),
});
export type RoadmapTaskData = z.infer<typeof RoadmapTaskSchema>;

export const WorkLogEntrySchema = z.object({
  timestamp: z.string(),
  runnerId: z.string(),
  role: z.string(),
  objective: z.string(),
  result: z.enum(["Succeeded", "Failed", "Pending"]),
  summary: z.string(),
});
export type WorkLogEntryData = z.infer<typeof WorkLogEntrySchema>;

export const LogFileSchema = z.object({
  title: z.string(),
  progress: z.string(),
  roadmap: z.array(RoadmapTaskSchema).optional().default([]),
  workLog: z.array(WorkLogEntrySchema).optional().default([]),
});
export type LogFileData = z.infer<typeof LogFileSchema>;
