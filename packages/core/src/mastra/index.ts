// import path from "node:path";
// import {createJixoApp} from "./app.js";

// const workDir = path.join(process.cwd(), "./");

// export const mastra = await createJixoApp(workDir);

import {Mastra} from "@mastra/core";
import {LibSQLStore} from "@mastra/libsql";
import {PinoLogger} from "@mastra/loggers";
import {mkdirSync} from "node:fs";
import path from "node:path";
import {pathToFileURL} from "node:url";
import {createChefAgent} from "./agent/chef.js";
import type {CreateAgentOptions} from "./agent/common.js";
import {createExecutorAgent, createPlannerAgent, createReviewerAgent} from "./agent/index.js";
import {jixoJobWorkflow} from "./workflows/jixoJobWorkflow.js";
import {jixoMasterWorkflow} from "./workflows/jixoMasterWorkflow.js";

const workDir = path.join(process.cwd(), "./");
const memoryFilepath = path.join(workDir, ".jixo/memory.db");
mkdirSync(path.dirname(memoryFilepath), {recursive: true});
const memoryStorage = new LibSQLStore({
  url: pathToFileURL(memoryFilepath).href,
});
const opts: CreateAgentOptions = {workDir, memoryStorage};
export const mastra = new Mastra({
  agents: {
    plannerAgent: await createPlannerAgent(opts),
    executorAgent: await createExecutorAgent(opts),
    reviewerAgent: await createReviewerAgent(opts),
    chefAgent: await createChefAgent(opts),
  },
  workflows: {
    jixoJobWorkflow,
    jixoMasterWorkflow,
  },
  storage: memoryStorage,
  logger: new PinoLogger({
    name: "JIXO",
    level: "debug",
    // level: "info",
  }),
  telemetry: {
    serviceName: "jixo",
    enabled: true,
    export: {
      type: "otlp",
      endpoint: "http://localhost:4318",
      // endpoint and headers will be picked up from env vars
    },
  },
});
// export const mastra =  creatJixoApp(workDir)
