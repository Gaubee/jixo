import {z} from "zod";
import {AnyTaskSchema, LogFileSchema, RoadmapTaskNodeSchema, WorkLogEntrySchema} from "../entities.js";

// --- Schema Definitions for the Inner Loop ---
export const JixoJobWorkflowInputSchema = z.object({
  jobName: z.string(),
  jobGoal: z.string(),
  runnerId: z.string(),
  otherRunners: z.array(z.string()),
  workDir: z.string(),
});

export const JixoJobWorkflowExitInfoSchema = z.object({
  exitCode: z.number(), // 0: Complete, 1: Error, 2: Standby/Continue
  reason: z.string(),
});
export type JixoJobWorkflowExitInfoData = z.infer<typeof JixoJobWorkflowExitInfoSchema>;

export const JixoRuntimeContextSchema = z.object({
  jobName: z.string().describe("The unique name of the current job."),
  jobGoal: z.string().describe("The high-level goal of the job."),
  workDir: z.string().describe("The absolute path to the sandboxed working directory for this job."),
  roadmap: z.array(RoadmapTaskNodeSchema).optional().describe("The entire current roadmap, for planning context."),
  task: AnyTaskSchema.optional().describe("The specific task being executed or reviewed."),
  recentWorkLog: z.array(WorkLogEntrySchema).optional().describe("A slice of the most recent work log entries for context."),
  taskSpecificLogs: z.array(WorkLogEntrySchema).optional().describe("Work logs filtered to be relevant only to the current task."),
  executionSummary: z.string().optional().describe("The summary provided by the executor for a completed task."),
  originalTaskDetails: z.string().optional().describe("The original 'details' of a task, used as an acceptance criteria for review."),
});
export type JixoRuntimeContextData = z.infer<typeof JixoRuntimeContextSchema>;

const PlanningContextSchema = z.object({
  type: z.enum(["initial", "rework", "fixFailure"]),
  task: AnyTaskSchema.optional(), // Can be a root or sub-task
});

const TriageBaseSchema = z.object({
  action: z.enum(["plan", "execute", "review", "exit"]),
  log: LogFileSchema,
});
export const TriagePlanSchema = TriageBaseSchema.extend({
  action: z.enum(["plan"]),
  planningContext: PlanningContextSchema,
});
export type TriagePlanData = z.infer<typeof TriagePlanSchema>;
export const TriageExecuteSchema = TriageBaseSchema.extend({
  action: z.enum(["execute"]),
  task: AnyTaskSchema,
});
export type TriageExecuteData = z.infer<typeof TriageExecuteSchema>;
export const TriageReviewSchema = TriageBaseSchema.extend({
  action: z.enum(["review"]),
  task: AnyTaskSchema,
});
export type TriageReviewData = z.infer<typeof TriageReviewSchema>;
export const TriageExitSchema = TriageBaseSchema.extend({
  action: z.enum(["exit"]),
  exitInfo: JixoJobWorkflowExitInfoSchema,
});
export type TriageExitData = z.infer<typeof TriageExitSchema>;
export const TriageOutputSchema = z.union([
  //
  TriagePlanSchema,
  TriageExecuteSchema,
  TriageReviewSchema,
  TriageExitSchema,
]);
export type TriageOutputData = z.infer<typeof TriageOutputSchema>;
