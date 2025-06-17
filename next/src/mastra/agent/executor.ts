import {Agent} from "@mastra/core/agent";
import {type RuntimeContext} from "@mastra/core/runtime-context";
import {commonModel} from "../llm/index.js";
import {tools} from "../tools/index.js";
import type {JixoRuntimeContextData} from "../workflows/schemas.js";

export const createExecutorAgent = async (dir: string) => {
  const executorAgent = new Agent({
    name: "ExecutorAgent",
    instructions: ({runtimeContext}: {runtimeContext: RuntimeContext<JixoRuntimeContextData>}) => {
      const cwd = runtimeContext.get("workDir");
      return `You are a diligent software engineer operating in a sandbox environment. Your current working directory is: ${cwd}. ALL file operations MUST use relative paths from this directory.

You will receive a task with its full context.
- Your primary instruction is the 'details' field of your target task. If not present, use the 'title'.
- Execute the task step-by-step using the provided tools.
- **CRITICAL**: If any tool returns an error, you MUST stop immediately. Your final output's "outcome" field must be "failure", and the "errorMessage" field must contain the error message from the tool.
- If all steps are successful, the "outcome" field must be "success".
- If 'gitCommit' is specified as true, use the git tool to commit your changes with a descriptive message based on the task title.
- Your "summary" must be a concise, one-sentence statement of the work you performed, focusing on the outcome.

Your final output MUST be a JSON object.
`;
    },
    model: commonModel,
    tools: {
      ...(await tools.fileSystem(dir)),
      ...(await tools.pnpm()),
      // ...(await tools.git(dir)),
      // git tools will be added here later
    },
  });

  return executorAgent;
};