import {z} from "zod";
import {AnyTaskSchema, WorkLogEntrySchema} from "../entities.js";
import {LogManager} from "../services/logManager.js";

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

// --- Role-Specific Runtime Context Schemas ---

// Base context, providing the essential LogManager service.
export const JobBaseRuntimeContextSchema = z.object({
  logManager: z.instanceof(LogManager),
});
export type JobBaseRuntimeContextData = z.infer<typeof JobBaseRuntimeContextSchema>;

// Context for the PlannerAgent's encapsulated hook.
export const PlannerRuntimeContextSchema = JobBaseRuntimeContextSchema.extend({});
export type PlannerRuntimeContextData = z.infer<typeof PlannerRuntimeContextSchema>;

// Context for the ExecutorAgent's encapsulated hook.
export const ExecutorRuntimeContextSchema = JobBaseRuntimeContextSchema.extend({
  task: AnyTaskSchema,
  recentWorkLog: z.array(WorkLogEntrySchema),
});
export type ExecutorRuntimeContextData = z.infer<typeof ExecutorRuntimeContextSchema>;

// Context for the ReviewerAgent's encapsulated hook.
export const ReviewerRuntimeContextSchema = JobBaseRuntimeContextSchema.extend({
  task: AnyTaskSchema,
  taskSpecificLogs: z.array(WorkLogEntrySchema),
  executionSummary: z.string(),
});
export type ReviewerRuntimeContextData = z.infer<typeof ReviewerRuntimeContextSchema>;

// --- Triage Step Schemas ---

/**
 * Defines the context for the initial planning phase.
 */
const PlanningInitialSchema = z.object({
  type: z.literal("initial"),
});

/**
 * Defines the context for planning a rework of a task.
 */
const PlanningReworkSchema = z.object({
  type: z.literal("rework"),
  task: AnyTaskSchema,
});

/**
 * Defines the context for planning a fix for a failed task.
 */
const PlanningFixFailureSchema = z.object({
  type: z.literal("fixFailure"),
  task: AnyTaskSchema,
  errorType: z.enum(["transient", "code_error", "unknown"]).optional(),
  errorSummary: z.string().optional(),
});

/**
 * A union of all possible planning contexts, ensuring type-safe handling in the planning step.
 */
const PlanningContextSchema = z.union([
  //
  PlanningInitialSchema,
  PlanningReworkSchema,
  PlanningFixFailureSchema,
]);

const TriageBaseSchema = z.object({
  action: z.enum(["plan", "execute", "review", "exit"]),
});

export const TriagePlanSchema = TriageBaseSchema.extend({
  action: z.literal("plan"),
  planningContext: PlanningContextSchema,
});
export type TriagePlanData = z.infer<typeof TriagePlanSchema>;

export const TriageExecuteSchema = TriageBaseSchema.extend({
  action: z.literal("execute"),
  task: AnyTaskSchema,
});
export type TriageExecuteData = z.infer<typeof TriageExecuteSchema>;

export const TriageReviewSchema = TriageBaseSchema.extend({
  action: z.literal("review"),
  task: AnyTaskSchema,
});
export type TriageReviewData = z.infer<typeof TriageReviewSchema>;

export const TriageExitSchema = TriageBaseSchema.extend({
  action: z.literal("exit"),
  exitInfo: JixoJobWorkflowExitInfoSchema,
});
export type TriageExitData = z.infer<typeof TriageExitSchema>;

export const TriageOutputSchema = z.union([TriagePlanSchema, TriageExecuteSchema, TriageReviewSchema, TriageExitSchema]);
export type TriageOutputData = z.infer<typeof TriageOutputSchema>;
