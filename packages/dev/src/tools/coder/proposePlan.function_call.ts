import {z} from "zod/v4";
import type {FunctionCallFn} from "../types.js";

export const name = "proposePlan";

export const description = "向用户提出一个高层级的行动计划以供审批。";

export const paramsSchema = z.object({
  plan_summary: z.string().describe("对整个计划的一句话总结。"),
  steps: z.array(z.string()).describe("一个有序列表，描述了计划执行的每一个具体步骤。"),
  estimated_tool_calls: z.array(z.string()).optional().describe("预估在计划批准后将会调用的主要工具列表。"),
});

/**
 * Renders a plan to the user and awaits their approval or rejection.
 * @param args - The plan details.
 * @param context - The context containing the `render` function.
 * @returns A promise resolving with an approval status.
 */
export const functionCall = (async (args, context) => {
  console.log("Proposing plan to user via UI:", args.plan_summary);

  try {
    const response = await context.render({
      component: "ProposePlanDialog",
      props: args,
    });

    if (response === true) {
      console.log("Plan was approved by the user.");
      return {status: "PLAN_APPROVED"};
    } else {
      // This handles both explicit rejection (response === false) and other falsy values.
      throw new Error("Plan was rejected by the user.");
    }
  } catch (error) {
    console.error("Failed to get plan approval:", error);
    // Re-throw the error to ensure the AI knows the tool failed.
    throw error;
  }
}) satisfies FunctionCallFn<z.infer<typeof paramsSchema>>;
