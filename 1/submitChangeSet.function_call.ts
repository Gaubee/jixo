import type {FunctionCallFn} from "npm:@jixo/dev/google-aistudio";
import z from "npm:zod";

export const name = "submitChangeSet";

export const description = "向用户展示一个文件变更集以供最终审批，并在批准后应用这些变更。";

const operationSchema = z.object({
  type: z.enum(["writeFile", "deleteFile", "renameFile"]),
  path: z.string().describe("被操作文件的完整路径。"),
  content: z.string().optional().describe("当type为'writeFile'时，提供文件的完整、最终内容。"),
  new_path: z.string().optional().describe("当type为'renameFile'时，提供文件的新路径。"),
});

export const paramsSchema = z.object({
  change_log: z.string().describe("严格符合Git Commit Message规范的变更日志。"),
  operations: z.array(operationSchema).describe("一个包含所有文件系统操作的原子列表。"),
  final_statement: z.string().describe("当这个变更集被成功应用后，你希望对用户说的总结性话语。"),
});

/**
 * Renders a change set to the user for final approval, then returns the operations if approved.
 * In a real scenario, the host environment (jixo-node) would execute the operations.
 * For now, this function simulates that by returning the operations upon approval.
 * @param args - The changeset details.
 * @param context - The context containing the `render` function.
 * @returns The original operations if approved, so the host can execute them.
 */
export const functionCall: FunctionCallFn<z.infer<typeof paramsSchema>> = async (args, context) => {
  console.log("Proposing changeset to user via UI for final approval.");

  try {
    const isApproved = await context.render({
      component: "SubmitChangeSetPanel",
      props: {
        change_log: args.change_log,
        operations: args.operations,
      },
    });

    if (isApproved === true) {
      console.log("Changeset was approved by the user.");
      // The tool's job is done. It returns the validated operations.
      // The host environment is now responsible for executing them.
      return {
        status: "CHANGESET_APPROVED",
        operations: args.operations,
        final_statement: args.final_statement,
      };
    } else {
      throw new Error("Changeset was rejected by the user.");
    }
  } catch (error) {
    console.error("Failed to get changeset approval:", error);
    throw error;
  }
};
