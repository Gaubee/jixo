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
import {createExecutorAgent, createPlannerAgent, createReviewerAgent} from "./agent/index.js";
import {jixoJobWorkflow} from "./workflows/jixoJobWorkflow.js";
import {jixoMasterWorkflow} from "./workflows/jixoMasterWorkflow.js";

const workDir = path.join(process.cwd(), "./");
const memoryFilepath = path.join(workDir, ".jixo/memory.db");
mkdirSync(path.dirname(memoryFilepath), {recursive: true});
const memoryStorage = new LibSQLStore({
  url: pathToFileURL(memoryFilepath).href,
});
export const mastra = new Mastra({
  agents: {
    plannerAgent: await createPlannerAgent({workDir, memoryStorage}),
    executorAgent: await createExecutorAgent({workDir, memoryStorage}),
    reviewerAgent: await createReviewerAgent({workDir, memoryStorage}),
  },
  workflows: {
    jixoJobWorkflow,
    jixoMasterWorkflow,
  },
  storage: memoryStorage,
  logger: new PinoLogger({
    name: "JIXO",
    // level: "debug",
    level: "info",
  }),
  telemetry: {
    serviceName: "jixo",
    enabled: true,
    export: {
      type: "otlp",
      endpoint: "http://localhost:4318/v1/traces",
      // endpoint and headers will be picked up from env vars
    },
  },
});
// export const mastra =  creatJixoApp(workDir)
