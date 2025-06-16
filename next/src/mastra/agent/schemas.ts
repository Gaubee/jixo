import {z} from "zod";

// Recursive schema for a new task input, mirroring NewTaskInput type but in Zod.
// This is the "contract" for our PlannerAgent.
const RecursiveNewTaskSchema: z.ZodType<any> = z.object({
  title: z.string(),
  description: z.string().optional(),
  details: z.string().optional(),
  dependsOn: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  gitCommit: z.union([z.boolean(), z.string()]).optional(),
  children: z.lazy(() => z.array(RecursiveNewTaskSchema)).optional(),
});

// The final schema that the PlannerAgent must adhere to.
export const PlannerOutputSchema = z.object({
  tasks: z.array(RecursiveNewTaskSchema),
});
