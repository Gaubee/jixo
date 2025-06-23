import {Mastra} from "@mastra/core";
import {LibSQLStore} from "@mastra/libsql";
import {type LogLevel, PinoLogger} from "@mastra/loggers";
import {mkdirSync} from "node:fs";
import path from "node:path";
import {pathToFileURL} from "node:url";
import {createExecutorAgent, createPlannerAgent, createReviewerAgent} from "./agent/index.js";
import {JixoApp_WS} from "./utils.js";
import {jixoJobWorkflow} from "./workflows/jixoJobWorkflow.js";
import {jixoMasterWorkflow} from "./workflows/jixoMasterWorkflow.js";

export type CreateJixoAppOptions = {
  workDir: string;
  logLevel?: LogLevel;
};
export const createJixoApp = async ({workDir, logLevel}: CreateJixoAppOptions) => {
  const memoryFilepath = path.join(workDir, ".jixo/memory.db");
  mkdirSync(path.dirname(memoryFilepath), {recursive: true});
  const memoryStorage = new LibSQLStore({
    url: pathToFileURL(memoryFilepath).href,
  });

  const app = new Mastra({
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
      level: logLevel,
    }),
    telemetry: {
      serviceName: "jixo",
      enabled: true,
      export: {
        type: "otlp",
        // endpoint and headers will be picked up from env vars
      },
    },
  });
  JixoApp_WS.add(app);

  return app;
};

export type JixoApp = Awaited<ReturnType<typeof createJixoApp>>;
