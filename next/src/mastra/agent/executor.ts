import {Agent} from "@mastra/core/agent";
import {commonModel} from "../llm/index.js";
import {tools} from "../tools/index.js";

export const createExecutorAgent = async (dir: string) => {
  const executorAgent = new Agent({
    name: "ExecutorAgent",
    instructions: `You are a diligent software engineer. You will receive a task with its full context (parent tasks).
- Your primary instruction is the 'details' field of your target task. If not present, use the 'title'.
- Execute the task using the provided tools.
- If 'gitCommit' is specified, use the git tool to commit your changes with a descriptive message.
Your output is a concise, one-sentence summary of the work you performed.`,
    model: commonModel,
    tools: {
      ...(await tools.fileSystem(dir)),
      ...(await tools.pnpm()),
      ...(await tools.git(dir)),
      // git tools will be added here later
    },
  });

  return executorAgent;
};
