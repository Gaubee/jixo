
import {array, boolean, object, string, union, unknown} from "zod/v4";
const z = {object, boolean, string, array, union, unknown};


export const zContentSchema = z.object({
  generationConfiguration: z.object({
    includeCodeExecutionTypesImport: z.boolean(),
    includeSchemaTypesImport: z.boolean(),
    includesRetrievalImport: z.boolean(),
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
      z.union([
        z.object({
          role: z.string(),
          parts: z.array(z.object({isLast: z.boolean(), text: z.string()})),
        }),
        z.object({
          role: z.string(),
          parts: z.array(
            z.union([
              z.object({isLast: z.boolean(), text: z.string()}),
              z.object({
                isLast: z.boolean(),
                functionCall: z.object({
                  name: z.string(),
                  parameters: z.string(),
                }),
              }),
            ]),
          ),
        }),
        z.object({
          role: z.string(),
          parts: z.array(
            z.object({
              isLast: z.boolean(),
              functionResponse: z.object({
                name: z.string(),
                response: z.string(),
              }),
            }),
          ),
        }),
        z.object({
          role: z.string(),
          parts: z.array(
            z.union([
              z.object({
                isLast: z.boolean(),
                functionResponse: z.object({
                  name: z.string(),
                  response: z.string(),
                }),
              }),
              z.object({text: z.string(), isLast: z.boolean()}),
            ]),
          ),
          isLast: z.boolean(),
        }),
      ]),
    ),
    config: z.object({
      thinkingConfig: z.object({thinkingBudget: z.string()}),
      stopSequences: z.array(z.unknown()),
      responseMimeType: z.string(),
      responseModalities: z.array(z.unknown()),
      safetySettings: z.array(z.unknown()),
      tools: z.array(
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
      ),
    }),
  }),
});