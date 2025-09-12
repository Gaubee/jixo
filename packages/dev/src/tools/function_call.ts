import {func_catch} from "@gaubee/util";
import {createRenderer} from "@jixo/tools-uikit";
import {readdirSync, statSync, type Stats} from "node:fs";
import path from "node:path";
import {pathToFileURL} from "node:url";
import {UIApiContext} from "../google-aistudio/jixo/SessionAPI.js";
import {zFunctionCallMiniModule, zFunctionCallStandardModule, type FunctionCallFn, type FunctionCallsMap, type FunctionCallStandardModule, type ToolContext} from "./types.js";

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
  const unsafeModule = await import(`${pathToFileURL(codeEntry.fullpath).href}?_=${codeEntry.stat?.mtime ?? ""}`);

  const safeModule = safeParseModule(unsafeModule);
  if (!safeModule) {
    console.warn(`无法解析 ${codeEntry.filename} 做为 functionCall 模块。`);
    return;
  }
  return {
    name: safeModule.name ?? codeEntry.filename,
    description: safeModule.description ?? String(safeModule.functionCall),
    // safeDescription: safeModule.description ?? String(safeModule.functionCall),
    paramsSchema: safeModule.paramsSchema,
    functionCall: safeModule.functionCall as FunctionCallFn,
  } satisfies FunctionCallStandardModule;
};

const supportImports = new Map([
  [
    /\.function_call\.js$/,
    {
      getKey: (filename: string) => filename.replace(/\.function_call\.js$/, ""),
      importer: esmImporter,
    },
  ],
  [
    /\.function_call\.ts$/,
    {
      getKey: (filename: string) => filename.replace(/\.function_call\.ts$/, ""),
      importer: esmImporter,
    },
  ],
] as const);

type CodeEntry = {
  key: string;
  filename: string;
  dirname: string;
  fullpath: string;
  stat?: Stats;
};
export const defineFunctionCalls = async (dir: string) => {
  const codeEntries: FunctionCallsMap = new Map<
    string,
    {
      codeEntry: CodeEntry;
      module: FunctionCallStandardModule;
    }
  >();
  for (const filename of readdirSync(dir)) {
    const fullpath = path.join(dir, filename);
    const stat = statSync(fullpath);
    if (!stat.isFile()) continue;

    for (const [suffix, config] of supportImports) {
      if (suffix.test(filename)) {
        const key = config.getKey(filename).trim();
        if (key != "") {
          const codeEntry = {key, filename, dirname: dir, fullpath, stat};
          const module = await config.importer(codeEntry);
          if (module) {
            codeEntries.set(codeEntry.key, {codeEntry, module});
            break;
          }
        }
      }
    }
  }
  return codeEntries;
};

/**
 * Creates a context object to be passed to a function call.
 * Crucially, it creates a renderer scoped to the current session.
 * @param sessionId - The session ID of the user triggering the function call.
 */
export function createFunctionCallContext(sessionId: string): ToolContext {
  const uiApi = UIApiContext.getOrNull();
  if (uiApi == null) {
    // TODO: 提供一个基于终端的交互
    throw new Error("UIApi is not available");
  }
  const render = createRenderer(async (_sessionId: string, command) => {
    const job = Promise.withResolvers();
    try {
      const payload = await func_catch(() => uiApi.renderJob(command.jobId, command.payload.component, command.payload.props))();
      if (payload.success) {
        job.resolve(payload.result);
      } else {
        job.reject();
      }
    } catch (err) {
      job.reject(err);
    }

    return job.promise;
  }, sessionId);

  return {render, sessionId};
}
