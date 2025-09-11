import type {RenderFunction} from "@jixo/tools-uikit";
import type {Stats} from "node:fs";
import {z} from "zod/v4-mini";

export const zFunctionCallConfig = z.object({
  name: z.string(),
  description: z.string(),
  paramsSchema: z.any(),
});
// The context is now standardized to carry essential services like the renderer.

export interface ToolContext {
  render: RenderFunction;
  sessionId: string;
}
// A function call can now accept a context object as a second argument.
export type FunctionCallFn<T extends object = any> = (parameters: T, context: ToolContext) => unknown;

export const zFunctionCallFn = z.instanceof(Function);

export const zFunctionCallStandardModule = z.object({
  ...zFunctionCallConfig.shape,
  functionCall: zFunctionCallFn,
});

export type FunctionCallStandardModule = z.output<typeof zFunctionCallStandardModule> & {
  functionCall: FunctionCallFn;
};

export const zFunctionCallMiniModule = z.extend(z.partial(zFunctionCallConfig), {
  functionCall: zFunctionCallFn,
});

type CodeEntry = {
  key: string;
  filename: string;
  dirname: string;
  fullpath: string;
  stat?: Stats;
};

export type FunctionCallsMap = Map<
  string,
  {
    codeEntry: CodeEntry;
    module: FunctionCallStandardModule;
  }
>;
