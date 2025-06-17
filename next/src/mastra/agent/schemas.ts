import {z} from "zod";
import {SubTaskSchema} from "../entities.js";

// Schema for a sub-task input. It cannot have children.
const NewSubTaskSchema = SubTaskSchema.omit({
  id: true,
  status: true,
  executor: true,
  reviewer: true,
  reworkReason: true,
  gitCommit: true,
});

export type NewSubTaskData = z.infer<typeof NewSubTaskSchema>;

// Schema for a root-level task input. It can have an array of sub-tasks.
export const NewTaskSchema = NewSubTaskSchema.extend({
  children: z.array(NewSubTaskSchema).optional().describe("A list of sub-tasks to be completed as part of this main task."),
});
export type NewTaskData = z.infer<typeof NewTaskSchema>;

export const AddTaskSchema = z.object({
  type: z.literal("add"),
  task: NewTaskSchema.required({
    description: true,
    details: true,
    checklist: true,
  }),
});

export const UpdateTaskSchema = z.object({
  type: z.literal("update"),
  id: z.string().describe("The ID of the task to update."),
  changes: NewTaskSchema.partial().describe("An object containing the fields to be updated on the specified task."),
});

export const CancelTaskSchema = z.object({
  type: z.literal("cancel"),
  id: z.string().describe("The ID of the task to cancel."),
});

// The final, powerful schema that the PlannerAgent must adhere to.
export const PlannerOutputSchema = z.union([AddTaskSchema, UpdateTaskSchema, CancelTaskSchema]).array();

//   .object({
//     add: AddTaskSchema.optional().describe(
//       "A list of new root-level tasks to add to the roadmap. For sub-tasks, use the 'update' operation on the parent task's 'children' field.",
//     ),
//     update: UpdateTasksSchema.optional().describe("A list of updates to apply to existing tasks."),
//     cancel: CancelTasksSchema.optional().describe("A list of task IDs to be marked as 'Cancelled'."),
//   })
//   .describe("A set of instructions to dynamically modify the project roadmap.");

// Schema for the structured output from the ExecutorAgent.
export const ExecutionResultSchema = z.object({
  outcome: z.enum(["success", "failure"]).describe("The final result of the execution attempt."),
  summary: z.string().describe("A concise, one-sentence summary of the work performed, focusing on the outcome."),
  errorMessage: z.string().optional().describe("If the outcome was a failure, a description of the error."),
});
export type ExecutionResultData = z.infer<typeof ExecutionResultSchema>;

// Schema for the structured output from the ReviewerAgent.
export const ReviewResultSchema = z.object({
  decision: z.enum(["approved", "rejected"]).describe("The final verdict of the review."),
  feedback: z.string().optional().describe("If rejected, a concise, actionable list of changes required."),
});
export type ReviewResultData = z.infer<typeof ReviewResultSchema>;
