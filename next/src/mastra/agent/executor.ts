import {Agent} from "@mastra/core/agent";
import {type RuntimeContext} from "@mastra/core/runtime-context";
import {commonModel} from "../llm/index.js";
import {tools} from "../tools/index.js";

export const createExecutorAgent = async (dir: string) => {
  const executorAgent = new Agent({
    name: "ExecutorAgent",
    instructions: ({runtimeContext}: {runtimeContext: RuntimeContext}) => {
      const cwd = runtimeContext.get("cwd") as string;
      return `You are a diligent software engineer operating in a sandbox environment.
Your current working directory is: ${cwd}

You will receive a task with its full context.
- Your primary instruction is the 'details' field of your target task. If not present, use the 'title'.
- Execute the task using the provided tools.
- If 'gitCommit' is specified as true, use the git tool to commit your changes with a descriptive message based on the task title.
- Your final output MUST be a concise, one-sentence summary of the work you performed. Focus on the outcome, not the process.`;
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
