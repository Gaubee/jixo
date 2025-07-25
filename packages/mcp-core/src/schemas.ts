import {z} from "zod/v3";

export const genericErrorRawShape = {
  name: z.string().describe("The type of error."),
  message: z.string().describe("A detailed description of what went wrong."),
  remedy_tool_suggestions: z
    .array(
      z.object({
        tool_name: z.string(),
        description: z.string(),
      }),
    )
    .optional()
    .describe("Suggested tools to run to fix the error."),
};
/**
 * The basic shape for a structured error response.
 * Can be extended by specific tools to add more context.
 */
export const GenericErrorShape = z.object(genericErrorRawShape);

/**
 * The base shape for all successful tool outputs.
 * The `success: z.literal(true)` is crucial for discriminated union type safety.
 */
export const BaseSuccessSchema = {
  success: z.literal(true).describe("Indicates the operation was successful."),
};

/**
 * The base shape for all failed tool outputs.
 * The `success: z.literal(false)` is crucial for discriminated union type safety.
 */
export const BaseErrorSchema = {
  success: z.literal(false).describe("Indicates the operation failed."),
  error: GenericErrorShape.describe("Details about the error that occurred."),
};
