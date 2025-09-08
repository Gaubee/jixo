import {z} from "zod/v4";
import type {FunctionCallFn} from "../types.js";

export const name = "logThought";

export const description = "用于外部化和记录AI的思考过程，并将这个过程展示给用户。";

export const paramsSchema = z.object({
  thought: z.string().describe("当前这一步的思考内容。可以是对问题的分析、一个假设、对风险的评估或一个初步想法。"),
  step: z.number().int().min(1).describe("当前思考是第几步。"),
  total_steps: z.number().int().min(1).describe("预估总共需要几步思考。"),
  is_conclusive: z.boolean().describe("设置为true表示思考过程已结束。"),
});

/**
 * Renders the AI's thought process into the UI.
 * This is a "fire-and-forget" operation from the AI's perspective,
 * but we still await the render call to ensure the UI command is sent.
 * @param args - The thought content and step information.
 * @param context - The context containing the `render` function.
 * @returns A simple status object.
 */
export const functionCall = (async (args, context) => {
  console.log(`Logging thought #${args.step}/${args.total_steps} to UI:`, args.thought);

  // We await the render call to ensure the message is sent before the tool returns.
  // The UI won't send a USER_RESPONSE, so the promise will resolve once the command is sent,
  // or reject if the connection fails.
  await context.render({
    component: "LogThoughtPanel",
    props: args,
  });

  const result = {
    status: "THOUGHT_LOGGED_TO_UI",
    step: args.step,
  };

  return result;
}) satisfies FunctionCallFn<z.infer<typeof paramsSchema>>;
