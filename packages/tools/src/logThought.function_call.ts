import z from "npm:zod";
import type {ToolContext} from "./askUser.tool.ts"; // Re-using ToolContext definition

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
 * This is a "fire-and-forget" operation from the AI's perspective.
 * @param args - The thought content and step information.
 * @param context - The context containing the `render` function.
 * @returns A simple status object.
 */
export const functionCall = async (args: z.infer<typeof paramsSchema>, context: ToolContext) => {
  console.log(`Logging thought #${args.step}/${args.total_steps} to UI:`, args.thought);

  // We call render but don't wait for a response, as this is for display only.
  // The UI won't send a USER_RESPONSE for this component.
  void context.render({
    component: "LogThoughtPanel",
    props: args,
  });

  // The function can return immediately.
  const result = {
    status: "THOUGHT_LOGGED_TO_UI",
    step: args.step,
  };

  return result;
};
