import {Mastra, type Config, type OtelConfig} from "@mastra/core";
import {LibSQLStore} from "@mastra/libsql";
import {PinoLogger, type LogLevel} from "@mastra/loggers";
import {mkdirSync} from "node:fs";
import path from "node:path";
import {pathToFileURL} from "node:url";
import {createChefAgent, type ChefAgent} from "./agent/chef.js";
import type {CreateAgentOptions} from "./agent/common.js";
import {createExecutorAgent, createPlannerAgent, createReviewerAgent, type ExecutorAgent, type PlannerAgent, type ReviewerAgent} from "./agent/index.js";
import {middleware} from "./server/middleware/index.js";
import {routes} from "./server/routes/index.js";
import {jixoJobWorkflow, type JixoJobWorkflow} from "./workflows/jixoJobWorkflow.js";
import {jixoMasterWorkflow, type JixoMasterWorkflow} from "./workflows/jixoMasterWorkflow.js";

export type CreateJixoAppOptions = {
  appName?: string;
  workDir: string;
  logLevel?: LogLevel;
  otlpEndpoint?: string;
};
export const jixoAppConfigFactory = async ({appName = "JIXO", workDir, logLevel, otlpEndpoint = "http://localhost:4318"}: CreateJixoAppOptions) => {
  const memoryFilepath = path.join(workDir, ".jixo/memory/shared.db");
  mkdirSync(path.dirname(memoryFilepath), {recursive: true});
  const memoryStorage = new LibSQLStore({
    url: pathToFileURL(memoryFilepath).href,
  });
  const opts: CreateAgentOptions = {workDir, memoryStorage};
  const logger = new PinoLogger({
    name: appName,
    level: logLevel,
  });
  return {
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
    logger: logger,
    telemetry:
      otlpEndpoint &&
      (await fetch(otlpEndpoint).then(
        () => true,
        () => false,
      ))
        ? {
            serviceName: appName,
            enabled: true,
            export: {
              type: "otlp",
              endpoint: otlpEndpoint,
            },
          }
        : void 0,
    server: {
      middleware: middleware,
      apiRoutes: routes,
    },
  } satisfies Config;
};

export type JixoAppConfig = {
  agents: {
    plannerAgent: PlannerAgent;
    executorAgent: ExecutorAgent;
    reviewerAgent: ReviewerAgent;
    chefAgent: ChefAgent;
  };
  workflows: {
    jixoJobWorkflow: JixoJobWorkflow;
    jixoMasterWorkflow: JixoMasterWorkflow;
  };
  storage: LibSQLStore;
  logger: PinoLogger;
  telemetry?: OtelConfig;

  vectors?: Config["vectors"];
  tts: Config["tts"];
  networks?: Config["networks"];
  mcpServers?: Config["mcpServers"];
};
export const createJixoApp = async ({appName = "JIXO", workDir, logLevel, otlpEndpoint}: CreateJixoAppOptions) => {
  const config = await jixoAppConfigFactory({appName, workDir, logLevel, otlpEndpoint});
  const app = new Mastra(config);

  return app;
};

export type JixoApp = Mastra<
  JixoAppConfig["agents"],
  {},
  JixoAppConfig["workflows"],
  RecordNoNull<JixoAppConfig["vectors"]>,
  RecordNoNull<JixoAppConfig["tts"]>,
  JixoAppConfig["logger"],
  RecordNoNull<JixoAppConfig["networks"]>,
  RecordNoNull<JixoAppConfig["mcpServers"]>
>;

type RecordNoNull<T> = T extends Record<string, any> ? T : {};
