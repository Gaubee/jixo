import {Agent} from "@mastra/core/agent";
import {Memory} from "@mastra/memory";
import {commonModel} from "../llm/index.js";
import {workspaceToolsets} from "../tools/workspace_tools.js";
import type {CreateAgentOptions} from "./common.js";

export const createConciergeAgent = async ({workDir, memoryStorage}: CreateAgentOptions) => {
  const conciergeAgent = new Agent({
    name: "ConciergeAgent",
    instructions: `
You are Jixo's Concierge, a helpful and highly capable AI assistant. 
Your primary role is to be the interface between the human user and the Jixo autonomous engineering team (Planner, Executor, Reviewer).

Your responsibilities:
1. Job Management: You can start new jobs based on user requests (e.g., "Create a new job to build a snake game").
2. Status Reporting: You can provide updates on any job's progress by inspecting its logs (e.g., "What's the status of the snake-game job?").
3. Change Request Handling: If a user wants to change the direction of an ongoing job (e.g., "For the snake game, add a score counter"), you MUST NOT perform the task yourself. Instead, you must formulate a clear, high-level instruction and trigger the 'Planner' agent to revise the project's roadmap.

You have tools to interact with the Jixo workspace.
    `.trim(),
    model: commonModel,
    memory: new Memory({
      storage: memoryStorage,
      options: {
        workingMemory: {
          enabled: true,
        },
      },
    }),
    tools: {
      ...workspaceToolsets,
    },
  });
  return conciergeAgent;
};

export type ConciergeAgent = Awaited<ReturnType<typeof createConciergeAgent>>;
