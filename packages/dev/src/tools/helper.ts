import {z} from "zod/v4";
import type {FunctionCallStandardModule, FunctionCallsMap} from "./types.js";

export const toParamsSchema = (zParams: z.ZodTypeAny) => {
  /**
   * https://github.com/vercel/ai/blob/main/packages/provider-utils/src/zod-schema.ts#L52
   */
  const jsonSchema = z.toJSONSchema(zParams, {
    target: "draft-7",
    io: "input",
    reused: "inline",
  });
  delete jsonSchema.$schema;
  return jsonSchema;
};

export const defineBuildInFunctionCalls = (agent: string, modules: Array<Required<FunctionCallStandardModule>>): FunctionCallsMap => {
  return new Map(
    modules.map((module) => {
      const filename = `${module.name}.function_call.ts`;
      const dirname = `<jixo_internal>/${agent}`;
      return [
        `${agent}_${module.name}`,
        {
          codeEntry: {
            key: module.name,
            filename,
            dirname,
            fullpath: `${dirname}/${filename}`,
          },
          module,
        },
      ] as const;
    }),
  ) satisfies FunctionCallsMap;
};
