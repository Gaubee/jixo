import {readdirSync, statSync, type Stats} from "node:fs";
import path from "node:path";
import {pathToFileURL} from "node:url";
import {z, type output} from "./z-min.js";

const zFunctionCallConfig = z.object({
  name: z.string(),
  description: z.string(),
  paramsSchema: z.optional(z.unknown()),
});
// z.toJSONSchema()

const zFunctionCallFn = z.function({
  input: [z.looseObject({})],
  output: z.any(),
});

/**
 * 标准版本
 */
const zFunctionCallStandardModule = z.looseObject({
  ...zFunctionCallConfig.shape,
  name: z.optional(z.string()),
  functionCall: zFunctionCallFn,
});
type FunctionCallStandardModule = output<typeof zFunctionCallStandardModule>;
/**
 * 极简版本，只导出一个 functionCall 函数即可
 * name 默认使用 `${infer name}.function.ts`
 * description 默认使用 functionCall.toString() 可以由AI猜测生成对应的params
 */
const zFunctionCallMiniModule = z.extend(z.partial(zFunctionCallConfig), {
  functionCall: zFunctionCallFn,
});
const zFunctionCallTool = z.extend(zFunctionCallConfig, {
  handler: zFunctionCallFn,
});

type FunctionCallTool = output<typeof zFunctionCallTool>;
const allFunctionCallTools = new Map<string, FunctionCallTool>();

const safeParseModule = (unsafeModule: any) => {
  if (unsafeModule.default) {
    const safeModule = zFunctionCallStandardModule.safeParse(unsafeModule.default);
    if (safeModule.success) {
      return safeModule.data;
    }
  }
  if (unsafeModule.functionCall) {
    const safeModule = zFunctionCallMiniModule.safeParse(unsafeModule);
    if (safeModule.success) {
      return safeModule.data;
    }
  }
};

const esmImporter = async (codeEntry: CodeEntry) => {
  const unsafeModule = await import(`${pathToFileURL(codeEntry.fullpath).href}?_=${codeEntry.stat.mtime}`);

  const safeModule = safeParseModule(unsafeModule);
  if (!safeModule) {
    console.warn(`无法解析 ${codeEntry.filename} 做为 functionCall 模块。`);
    return;
  }
  return {
    name: safeModule.name ?? codeEntry.filename,
    description: safeModule.description ?? String(safeModule.functionCall),
    paramsSchema: safeModule.paramsSchema,
    functionCall: safeModule.functionCall,
  } satisfies FunctionCallStandardModule;
};

const supportImports = new Map([
  //
  [
    /\.function_call\.js$/,
    {
      getKey: (filename: string) => {
        return filename.replace(/\.function_call\.js$/, "");
      },
      importer: esmImporter,
    },
  ],
  [
    /\.function_call\.ts$/,
    {
      getKey: (filename: string) => {
        return filename.replace(/\.function_call\.ts$/, "");
      },
      importer: esmImporter,
    },
  ],
] as const);

type CodeEntry = {
  key: string;
  filename: string;
  dirname: string;
  fullpath: string;
  stat: Stats;
};
export const defineFunctionCall = async (dir: string) => {
  const codeEntries = new Map<
    string,
    {
      codeEntry: CodeEntry;
      module: FunctionCallStandardModule;
    }
  >();
  for (const filename of readdirSync(dir)) {
    const fullpath = path.join(dir, filename);
    const stat = statSync(fullpath);
    if (!stat.isFile()) {
      return;
    }

    let key: string | undefined;
    for (const [suffix, config] of supportImports) {
      if (suffix.test(filename)) {
        key = config.getKey(filename).trim();

        if (key != "") {
          const codeEntry = {key, filename, dirname: dir, fullpath, stat} satisfies CodeEntry;
          const module = await config.importer(codeEntry);
          if (module) {
            codeEntries.set(codeEntry.key, {codeEntry, module});
            break;
          }
        }
      }
    }
  }
};
