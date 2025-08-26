import type {RenderFunction} from "@jixo/tools-uikit";
import {type output, z} from "./z-min.js";
export const zContentsSchema = z.array(
  z.object({
    role: z.string(),
    parts: z.array(
      z.union([
        // 普通文本
        z.object({isLast: z.optional(z.boolean()), text: z.string()}),
        // FunctionCall 请求
        z.object({
          isLast: z.optional(z.boolean()),
          functionCall: z.object({
            name: z.string(),
            parameters: z.string(),
          }),
        }),
        // FunctionCall 返回
        z.object({
          isLast: z.optional(z.boolean()),
          functionResponse: z.object({
            name: z.string(),
            response: z.string(),
          }),
        }),
        // 文件
        z.object({
          isLast: z.optional(z.boolean()),
          inlineData: z.object({
            data: z.string(),
            splitData: z.array(z.string()),
            mimeType: z.string(),
          }),
          fileData: z.object({
            mimeType: z.string(),
            fileIndex: z.number(),
            fileName: z.string(),
          }),
        }),
        // 空对象块
        z.object({isLast: z.optional(z.boolean())}),
      ]),
    ),
    isLast: z.optional(z.boolean()),
  }),
);

export const zAiStudioContentSchema = z.looseObject({
  generationConfiguration: z.looseObject({
    includeCodeExecutionTypesImport: z.boolean(),
    includeSchemaTypesImport: z.boolean(),
    includesRetrievalImport: z.optional(z.boolean()),
    isAudioOutput: z.boolean(),
    isStreamingConfigEnabled: z.boolean(),
    isColab: z.boolean(),
    requiresParts: z.boolean(),
    requiresFunctionCalling: z.boolean(),
    requiresCodeExecution: z.boolean(),
  }),
  generateContentParameters: z.object({
    model: z.string(),
    contents: zContentsSchema,
    config: z.looseObject({
      thinkingConfig: z.object({thinkingBudget: z.string()}),
      stopSequences: z.array(z.unknown()),
      responseMimeType: z.optional(z.string()),
      responseModalities: z.array(z.unknown()),
      safetySettings: z.array(z.unknown()),
      tools: z.array(
        z.union([
          z.object({googleSearch: z.looseObject({})}),
          z.object({urlContext: z.looseObject({})}),
          z.object({
            functionDeclarations: z.array(
              z.object({
                name: z.string(),
                description: z.string(),
                parameters: z.string(),
                isLast: z.boolean(),
              }),
            ),
          }),
        ]),
      ),
    }),
  }),
});

export type AiStudioContentSchema = output<typeof zAiStudioContentSchema>;

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
  // other context properties like sessionId can be here if needed,
  // but they are now encapsulated within the renderer.
}
// A function call can now accept a context object as a second argument.
export type FunctionCallFn = <T extends object = object>(parameters: T, context: ToolContext) => unknown;

export const zFunctionCallFn = z.instanceof(Function);

export const zFunctionCallStandardModule = z.looseObject({
  ...zFunctionCallConfig.shape,
  name: z.optional(z.string()),
  functionCall: zFunctionCallFn,
});

export type FunctionCallStandardModule = output<typeof zFunctionCallStandardModule> & {
  functionCall: FunctionCallFn;
};

export const zFunctionCallMiniModule = z.extend(z.partial(zFunctionCallConfig), {
  functionCall: zFunctionCallFn,
});
