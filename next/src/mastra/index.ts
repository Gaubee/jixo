import {Mastra} from "@mastra/core";
import {LibSQLStore} from "@mastra/libsql";
import {PinoLogger} from "@mastra/loggers";
import path from "node:path";
import {createExecutorAgent, plannerAgent, reviewerAgent} from "./agent/index.js";
import {jixoJobWorkflow} from "./workflows/jixoJobWorkflow.js";
import {jixoMasterWorkflow} from "./workflows/jixoMasterWorkflow.js";

const workDir = path.join(process.cwd(), "./");

export const mastra = new Mastra({
  agents: {
    plannerAgent,
    executorAgent: await createExecutorAgent(workDir),
    reviewerAgent,
  },
  workflows: {
    jixoJobWorkflow,
    jixoMasterWorkflow,
  },
  storage: new LibSQLStore({url: ":memory:"}),
  logger: new PinoLogger({name: "JIXO", level: "info"}),
});
