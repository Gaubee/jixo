import {YAML} from "@gaubee/nodekit";
import type {Mastra} from "@mastra/core";
import {Agent} from "@mastra/core/agent";
import {thinkModel} from "../llm/index.js";
import {type LogManager} from "../services/logManager.js";
import {tools} from "../tools/index.js";
import {PlannerOutputSchema} from "./schemas.js";

export const plannerAgent = new Agent({
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
});
const split = "```";
export const usePlannerAgent = (mastra: Mastra, planningPrompt: string, args: {logManager: LogManager}) => {
  const {logManager} = args;
  const {
    roadmap,
    info: {workDir, jobGoal},
  } = logManager.getLogFile();

  const roadmapMd = roadmap.length ? `${split}yaml\n${YAML.stringify(roadmap)}\n${split}` : "";

  const finalPrompt = `
The project's working directory is: \`${workDir}\`. ALL file paths in your plan must be relative to this directory.

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

  return mastra.getAgent("plannerAgent").generate(finalPrompt, {
    output: PlannerOutputSchema,
    toolsets: {
      log: logToolset, // Correctly pass tools via the toolsets option
    },
  });
};
