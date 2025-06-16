import {delay} from "@gaubee/util";
import {Mastra} from "@mastra/core";
import {Agent} from "@mastra/core/agent";
import {createStep, createWorkflow} from "@mastra/core/workflows";
import {LibSQLStore} from "@mastra/libsql";
import {PinoLogger} from "@mastra/loggers";
import path from "node:path";
import {uuidv7} from "uuidv7";
import {z} from "zod";
import {commonModel, thinkModel} from "./llm/index.js";
import {logManager} from "./services/logManager.js";
import {tools} from "./tools/index.js";

// --- Agent 定义 ---
const plannerAgent = new Agent({
  name: "PlannerAgent",
  instructions: `You are a master planner. Your role is to analyze the user's job and the current state, then create or update a 'Roadmap'. The roadmap should be a series of clear, atomic, and sequential tasks in Markdown checklist format. Return ONLY the Markdown content for the new roadmap, starting with the first task item (e.g., '- [ ] ...').`,
  model: thinkModel,
});

const runnerAgent = new Agent({
  name: "RunnerAgent",
  instructions: `You are an executor. You will be given a specific task to complete. Perform the task and return a concise, one-sentence summary of the work you did.`,
  model: commonModel,
  tools: {
    ...(await tools.fileSystem(path.join(process.cwd(), "demo"))),
    ...(await tools.pnpm()),
  },
});


// [Placeholder for Workflow Definitions - To be refactored next]
// The old jixoJobWorkflow, Job/Task classes, and runJixoOuterLoop
// are intentionally removed. We will build the new Master/Job workflows
// on top of our new, robust logManager in the next step.
const placeholderWorkflow = createWorkflow({ id: "placeholder" }).commit();


// --- Mastra 实例注册 ---
export const mastra = new Mastra({
  agents: {
    plannerAgent,
    runnerAgent,
    // Note: parserAgent is encapsulated within logManager and not registered globally.
  },
  workflows: {
    // jixoJobWorkflow will be re-added here after the next refactor
    placeholderWorkflow,
  },
  storage: new LibSQLStore({url: ":memory:"}),
  logger: new PinoLogger({name: "JIXO-on-Mastra", level: "info"}),
});

console.log("JIXO V3 Core Services Initialized. Ready for MasterWorkflow implementation.");