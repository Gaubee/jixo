import {z} from "zod";
import {AnyTaskSchema, LogFileSchema} from "../entities.js";

// --- Schema Definitions for the Inner Loop ---
export const JixoJobWorkflowInputSchema = z.object({
  jobName: z.string(),
  jobGoal: z.string(),
  runnerId: z.string(),
  otherRunners: z.array(z.string()),
});

export const JixoJobWorkflowExitInfoSchema = z.object({
  exitCode: z.number(), // 0: Complete, 1: Error, 2: Standby/Continue
  reason: z.string(),
});
const PlanningContextSchema = z.object({
  type: z.enum(["initial", "rework", "fixFailure"]),
  task: AnyTaskSchema.optional(), // Can be a root or sub-task
});
export const TriageOutputSchema = z.object({
  action: z.enum(["plan", "execute", "review", "exit"]),
  log: LogFileSchema,
  task: AnyTaskSchema.optional(), // Use the flexible union type
  planningContext: PlanningContextSchema.optional(),
  exitInfo: JixoJobWorkflowExitInfoSchema.optional(),
});
export type TriageOutputData = z.infer<typeof TriageOutputSchema>;
