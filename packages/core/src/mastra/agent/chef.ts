import {Agent} from "@mastra/core/agent";
import {Memory} from "@mastra/memory";
import {commonModel} from "../llm/index.js";
import type {CreateAgentOptions} from "./common.js";
export const createChefAgent = async ({workDir, memoryStorage}: CreateAgentOptions) => {
  const chefAgent = new Agent({
    name: "chefAgent",
    instructions: "You are Michel, a practical and experienced home chef. " + "You help people cook with whatever ingredients they have available.",
    model: commonModel,
    memory: new Memory({
      storage: memoryStorage,
      options: {
        workingMemory: {
          enabled: true,
        },
      },
    }),
  });
  return chefAgent;
};
