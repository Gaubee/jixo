import {Mastra} from "@mastra/core";
import {LibSQLStore} from "@mastra/libsql";
import {PinoLogger} from "@mastra/loggers";
import {createExecutorAgent, createPlannerAgent, createReviewerAgent} from "./agent/index.js";
import {JixoApp_WS} from "./utils.js";
import {jixoJobWorkflow} from "./workflows/jixoJobWorkflow.js";
import {jixoMasterWorkflow} from "./workflows/jixoMasterWorkflow.js";

export const createJixoApp = async (workDir: string) => {
  const app = new Mastra({
    agents: {
      plannerAgent: await createPlannerAgent(workDir),
      executorAgent: await createExecutorAgent(workDir),
      reviewerAgent: await createReviewerAgent(workDir),
    },
    workflows: {
      jixoJobWorkflow,
      jixoMasterWorkflow,
    },
    storage: new LibSQLStore({url: ":memory:"}),
    logger: new PinoLogger({
      name: "JIXO",
      // level: "debug",
      level: "info",
    }),
  });
  JixoApp_WS.add(app);

  return app;
};

export type JixoApp = Awaited<ReturnType<typeof createJixoApp>>;
