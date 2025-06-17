import {z} from "zod";
import {AnyTaskSchema, LogFileSchema} from "../entities.js";

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
