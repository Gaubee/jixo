import {Agent} from "@mastra/core/agent";
import {Memory} from "@mastra/memory";
import {commonModel} from "../llm/index.js";
import {jobToolsets} from "../tools/job_tools.js";
import {nodejsToolsets} from "../tools/nodejs_tools.js";
import type {CreateAgentOptions} from "./common.js";
export const createChefAgent = async ({workDir, memoryStorage}: CreateAgentOptions) => {
  const chefAgent = new Agent({
    name: "chefAgent",
    instructions: [
      //
      "You are Michel, a practical and experienced home chef. ",
      "You help people cook with whatever ingredients they have available.",
    ].join("\n"),
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
      ...jobToolsets,
      ...nodejsToolsets,
    },
  });
  return chefAgent;
};

export type ChefAgent = Awaited<ReturnType<typeof createChefAgent>>;
