import path from "node:path";
import type {AgentMetadata, PageToolConfig} from "../google-aistudio/browser/index.js";
import {coderFunctionCallsMap} from "./coder/index.js";
import {defineFunctionCalls} from "./function_call.js";
import type {FunctionCallsMap} from "./types.js";

/**
 * Loads both built-in and user-defined tools, with user tools overriding built-in ones.
 * @returns A map of function calls and a list of tool declarations for the config.
 */

export async function loadAgentTools({agent, workDir, tools}: Pick<AgentMetadata, "agent" | "workDir" | "tools">) {
  const allTools = new Map<string, Awaited<ReturnType<typeof defineFunctionCalls>> extends Map<any, infer V> ? V : never>();
  const toolDeclarations: Array<PageToolConfig> = [];

  // 1. Load built-in tools
  let builtInFc: FunctionCallsMap;
  if (agent === "coder") {
    builtInFc = coderFunctionCallsMap;
  } else {
    builtInFc = new Map();
  }
  for (const [key, value] of builtInFc) {
    allTools.set(key, value);
  }

  // 2. Load user-defined tools from workspace
  try {
    const userFc = await defineFunctionCalls(path.join(workDir, "tools"));
    for (const [key, value] of userFc) {
      allTools.set(key, value); // User tool overrides built-in
    }
  } catch (error) {
    // It's okay if the user's tool directory doesn't exist or has errors.
    if (error instanceof Error && "code" in error && error.code !== "ENOENT") {
      console.warn(`Could not load user-defined tools from ${workDir}:`, error);
    }
  }

  // 3. Generate final declarations for config
  const exclude = new Set(tools?.exclude ?? []);
  for (const [key, {codeEntry, module}] of allTools) {
    const {description, paramsSchema} = module;

    toolDeclarations.push({
      name: key,
      description,
      parameters: paramsSchema,
      filepath: codeEntry.filename,
      disabled: exclude.has(key),
    });
  }

  return {tools: allTools, toolDeclarations};
}

export type AgentTools = Awaited<ReturnType<typeof loadAgentTools>>;

// console.log(JSON.stringify((await loadAgentTools({agent: "coder", workDir: "/"})).toolDeclarations,null,2));
