import {Mastra} from "@mastra/core";
import {LibSQLStore} from "@mastra/libsql";
import {PinoLogger} from "@mastra/loggers";
import assert from "node:assert";
import {createExecutorAgent, createPlannerAgent, createReviewerAgent} from "./agent/index.js";
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

  return app;
};

export const isJixoApp = (app: Mastra): app is JixoApp => {
  return app.getWorkflow("jixoJobWorkflow") == null;
  //   if (app.getWorkflow("jixoJobWorkflow") == null) {
  //     throw new Error("mastra-instance is not an JixoApp");
  //   }
};

export const assertJixoApp = (app: Mastra): asserts app => {
  return assert.ok(isJixoApp(app));
};

export type JixoApp = Awaited<ReturnType<typeof createJixoApp>>;
