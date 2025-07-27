import {type infer as Infer, array, boolean, looseObject, number, object, optional, partial, string, union, unknown} from "zod/v4-mini";
const z = {object, boolean, string, array, union, unknown, number, optional, partial, looseObject};

export const zContentSchema = z.looseObject({
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
    contents: z.array(
      z.object({
        role: z.string(),
        parts: z.array(
          z.union([
            // 异常对象块
            z.object({isLast: z.boolean()}),
            // 普通文本
            z.object({isLast: z.boolean(), text: z.string()}),
            // FunctionCall 请求
            z.object({
              isLast: z.boolean(),
              functionCall: z.object({
                name: z.string(),
                parameters: z.string(),
              }),
            }),
            // FunctionCall 返回
            z.object({
              isLast: z.boolean(),
              functionResponse: z.object({
                name: z.string(),
                response: z.string(),
              }),
            }),
            // 文件
            z.object({
              isLast: z.boolean(),
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
          ]),
        ),
        isLast: z.optional(z.boolean()),
      }),
    ),
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

export type ContentSchema = Infer<typeof zContentSchema>;
