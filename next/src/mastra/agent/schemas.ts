import {z} from "zod";

// Schema for a sub-task input. It cannot have children.
const NewSubTaskSchema = z.object({
  title: z.string().describe("The concise, human-readable title of the sub-task."),
  description: z.string().optional().describe("An optional, brief explanation of the sub-task's objective."),
  details: z.string().optional().describe("Detailed, step-by-step instructions for the executor."),
  dependsOn: z.array(z.string()).optional().describe("A list of task IDs that must be completed before this task can start."),
  tags: z.array(z.string()).optional().describe("Keywords for categorizing the task."),
  gitCommit: z.boolean().optional().describe("Instruction for git commit after completion."),
});
export type NewSubTaskData = z.infer<typeof NewSubTaskSchema>;

// Schema for a root-level task input. It can have an array of sub-tasks.
export const NewTaskSchema = NewSubTaskSchema.extend({
  children: z.array(NewSubTaskSchema).optional().describe("A list of sub-tasks to be completed as part of this main task."),
});
export type NewTaskData = z.infer<typeof NewTaskSchema>;

export const AddTasksSchema = z
  .array(NewTaskSchema)
  .describe("A list of new root-level tasks to add to the roadmap. For sub-tasks, use the 'update' operation on the parent task's 'children' field.");

export const UpdateTasksSchema = z
  .array(
    z.object({
      id: z.string().describe("The ID of the task to update."),
      changes: NewTaskSchema.partial().describe("An object containing the fields to be updated on the specified task."),
    }),
  )
  .describe("A list of updates to apply to existing tasks.");

export const CancelTasksSchema = z.array(z.string()).describe("A list of task IDs to be marked as 'Cancelled'.");

// The final, powerful schema that the PlannerAgent must adhere to.
export const PlannerOutputSchema = z
  .object({
    add: AddTasksSchema,
    update: UpdateTasksSchema,
    cancel: CancelTasksSchema,
  })
  .partial()
  .describe("A set of instructions to dynamically modify the project roadmap.");
