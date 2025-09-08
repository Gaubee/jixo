import type {RenderFunction} from "@jixo/tools-uikit";
import {z} from "zod/v4-mini";

export const zFunctionCallConfig = z.object({
  name: z.string(),
  description: z.optional(z.string()),
  safeDescription: z.string(),
  paramsSchema: z.optional(z.unknown()),
});
// The context is now standardized to carry essential services like the renderer.

export interface ToolContext {
  render: RenderFunction;
  sessionId: string;
}
// A function call can now accept a context object as a second argument.
export type FunctionCallFn<T extends object = object> = (parameters: T, context: ToolContext) => unknown;

export const zFunctionCallFn = z.instanceof(Function);

export const zFunctionCallStandardModule = z.looseObject({
  ...zFunctionCallConfig.shape,
  name: z.optional(z.string()),
  functionCall: zFunctionCallFn,
});

export type FunctionCallStandardModule = z.output<typeof zFunctionCallStandardModule> & {
  functionCall: FunctionCallFn;
};

export const zFunctionCallMiniModule = z.extend(z.partial(zFunctionCallConfig), {
  functionCall: zFunctionCallFn,
});
