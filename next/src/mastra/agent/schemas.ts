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

// Schema for a root-level task input. It can have an array of sub-tasks.
const NewTaskSchema = NewSubTaskSchema.extend({
  children: z.array(NewSubTaskSchema).optional().describe("A list of sub-tasks to be completed as part of this main task."),
});

// The final schema that the PlannerAgent must adhere to.
export const PlannerOutputSchema = z.object({
  tasks: z.array(NewTaskSchema).describe("An array of new tasks to be added to the roadmap."),
});
