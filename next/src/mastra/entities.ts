import {z} from "zod";

// A SubTask cannot have its own children, enforcing a 2-level hierarchy.
export const SubTaskSchema = z.object({
  id: z.string().describe("A unique, period-separated identifier for the sub-task (e.g., '1.1', '1.2')."),
  title: z.string().describe("The concise, human-readable title of the sub-task."),
  description: z.string().optional().describe("An optional, brief explanation of the sub-task's objective."),
  details: z.string().optional().describe("Detailed, step-by-step instructions or context for the executor, potentially in Markdown format."),
  checklist: z.array(z.string()).optional().describe("A machine-readable list of success criteria or deliverables for the reviewer to verify."),
  status: z.enum(["Pending", "Locked", "Completed", "Failed", "Cancelled", "PendingReview"]).describe("The current lifecycle status of the task."),
  executor: z.string().optional().describe("The ID of the runner currently assigned to execute this task."),
  reviewer: z.string().optional().describe("The ID of the runner assigned to review this task."),
  dependsOn: z.array(z.string()).optional().describe("A list of task IDs that must be completed before this task can start."),
  tags: z.array(z.string()).optional().describe("Keywords for categorizing the task (e.g., 'backend', 'refactor')."),
  gitCommit: z.boolean().optional().describe("Whether to perform a git commit after completion."),
});

// A root-level task can have children, but only of the SubTask type.
export const RoadmapTaskNodeSchema = SubTaskSchema.extend({
  children: z.array(SubTaskSchema).describe("A list of sub-tasks to be completed as part of this main task.").default([]),
});

// A new union type to represent either a root task or a sub-task.
export const AnyTaskSchema = z.union([RoadmapTaskNodeSchema, SubTaskSchema]);

export type RoadmapTaskNodeData = z.infer<typeof RoadmapTaskNodeSchema>;
export type SubTaskData = z.infer<typeof SubTaskSchema>;
export type AnyTaskData = z.infer<typeof AnyTaskSchema>;

export const WorkLogEntrySchema = z.object({
  timestamp: z.string().datetime().describe("The ISO 8601 timestamp of when the log entry was created."),
  runnerId: z.string().describe("The unique ID of the JIXO runner instance that performed the action."),
  role: z.enum(["Planner", "Executor", "Reviewer"]).describe("The role of the agent that performed the action."),
  objective: z.string().describe("A brief description of the goal for the action being logged."),
  result: z.enum(["Succeeded", "Failed", "Pending"]).describe("The outcome of the action."),
  summary: z.string().describe("A detailed summary of what was done and the result."),
});
export type WorkLogEntryData = z.infer<typeof WorkLogEntrySchema>;

export const LogFileSchema = z.object({
  title: z.string().describe("The overall title of the job, derived from the user's goal."),
  progress: z.string().describe("A percentage string representing the job's estimated completion."),
  env: z.record(z.string()).optional().describe("Environment variables for the job, e.g., workDir."),
  roadmap: z.array(RoadmapTaskNodeSchema).optional().default([]).describe("The hierarchical list of tasks to be executed for the job."),
  workLog: z.array(WorkLogEntrySchema).optional().default([]).describe("An immutable, time-ordered log of all actions taken during the job."),
});
export type LogFileData = z.infer<typeof LogFileSchema>;

export const DELETE_FIELD_MARKER = "<!--DELETE-->";
