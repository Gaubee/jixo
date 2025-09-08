import type {FunctionCallFn} from "../types.js";
import {z} from "zod/v4";

export const name = "askUser";

export const description = "当遇到歧义、需要决策或缺少关键信息时，向用户提问并等待响应。";

export const paramsSchema = z.object({
  question: z.string().describe("需要向用户提出的、清晰具体的问题。"),
  options: z.array(z.string()).optional().describe("如果提供，则向用户呈现一个选项列表，用户必须从中选择一个。"),
});

/**
 * Uses the injected render function from the context to display a UI prompt.
 * @param args - The question and options to ask the user.
 * @param context - The context containing the `render` function.
 * @returns A promise that resolves with the user's response.
 */
export const functionCall: FunctionCallFn<z.infer<typeof paramsSchema>> = async (args, context) => {
  console.log(`Asking user via UI: "${args.question}"`);

  try {
    const response = await context.render({
      component: "AskUserDialog", // The name for the UI component
      props: {
        question: args.question,
        options: args.options,
      },
    });

    console.log(`Received user response:`, response);
    return response;
  } catch (error) {
    console.error("Failed to get user response:", error);
    // Rethrow the error to let the caller know the FC failed.
    throw error;
  }
};
