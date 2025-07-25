import {YAML} from "@gaubee/nodekit";
import type {Mastra} from "@mastra/core";
import {Agent} from "@mastra/core/agent";
import {Memory} from "@mastra/memory";
import {thinkModel} from "../llm/index.js";
import {type LogManager} from "../services/logManager.js";
import {tools} from "../tools/index.js";
import {isJixoApp, ok} from "../utils.js";
import {agentGenerateStructuredOutput, type CreateAgentOptions} from "./common.js";
import {PlannerOutputSchema} from "./schemas.js";
export const createPlannerAgent = async ({jobDir, memoryStorage}: CreateAgentOptions) => {
  const plannerAgent = new Agent({
    name: "PlannerAgent",
    instructions: `You are an expert project planner AI. Your job is to analyze the provided context (job goal, current roadmap, and specific planning scenario) and generate a set of instructions to modify the project roadmap.

Your output MUST be a valid JSON object that strictly adheres to the provided schema.

### Context & Tools
You are provided with the most relevant context for your current task. For most planning activities, this is sufficient. However, for special analysis or reporting tasks, you have access to the following tools:
- \`getFullRoadmap\`: To get a complete project overview.
- \`getWorkLogHistory\`: To analyze past actions.
- \`getFullLogFile\`: (Use with caution) To get all job data.

### Core Actions:
- **add**: Use this to create new root-level tasks and their sub-tasks.
- **update**: Use this to modify existing tasks, including adding new sub-tasks.
- **cancel**: Use this to mark tasks that are no longer relevant as 'Cancelled'.

### Task Generation Rules:
For every new task or sub-task you create, you MUST provide:
1.  **details**: A clear, step-by-step guide for the Executor Agent in Markdown format.
2.  **checklist**: A machine-readable list of 1-3 concrete success criteria for the Reviewer Agent.

Analyze the user's request carefully and provide a precise and actionable plan.`,
    model: thinkModel,
    memory: new Memory({
      storage: memoryStorage,
      options: {
        workingMemory: {
          enabled: true,
        },
      },
    }),
  });
  return plannerAgent;
};

export type PlannerAgent = Awaited<ReturnType<typeof createPlannerAgent>>;

const MD_CODE_WRAPPER = "```";
export const usePlannerAgent = async (mastra: Mastra, planningPrompt: string, args: {logManager: LogManager}) => {
  ok(isJixoApp(mastra));
  const {logManager} = args;
  const {
    roadmap,
    info: {jobDir, jobGoal},
  } = logManager.getLogFile();

  const roadmapMd = roadmap.length ? `${MD_CODE_WRAPPER}yaml\n${YAML.stringify(roadmap)}\n${MD_CODE_WRAPPER}` : "";

  const finalPrompt = `
The project's working directory is: \`${jobDir}\`. ALL file paths in your plan must be relative to this directory.

### Overall Job Goal
${jobGoal}

### Current Roadmap
${roadmapMd || "_No tasks planned yet._"}

---

### Your Current Planning Task
${planningPrompt}
`;

  // Dynamically create the toolset for this specific call
  const logToolset = tools.logTools(logManager);

  const result = await agentGenerateStructuredOutput(mastra.getAgent("plannerAgent"), finalPrompt, PlannerOutputSchema, {
    toolsets: {
      log: logToolset, // Correctly pass tools via the toolsets option
    },
  });
  return result;
};
