import {type infer as Infer, array, boolean, number, object, string, union, unknown} from "zod/v4";
const z = {object, boolean, string, array, union, unknown, number};

export const zContentSchema = z
  .object({
    generationConfiguration: z
      .object({
        includeCodeExecutionTypesImport: z.boolean(),
        includeSchemaTypesImport: z.boolean(),
        includesRetrievalImport: z.boolean().optional(),
        isAudioOutput: z.boolean(),
        isStreamingConfigEnabled: z.boolean(),
        isColab: z.boolean(),
        requiresParts: z.boolean(),
        requiresFunctionCalling: z.boolean(),
        requiresCodeExecution: z.boolean(),
      })
      .partial(),
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
          isLast: z.boolean().optional(),
        }),
      ),
      config: z.object({
        thinkingConfig: z.object({thinkingBudget: z.string()}),
        stopSequences: z.array(z.unknown()),
        responseMimeType: z.string().optional(),
        responseModalities: z.array(z.unknown()),
        safetySettings: z.array(z.unknown()),
        tools: z.array(
          z.union([
            z.object({googleSearch: z.object({})}),
            z.object({urlContext: z.object({})}),
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
  })
  .loose();

export type ContentSchema = Infer<typeof zContentSchema>;
