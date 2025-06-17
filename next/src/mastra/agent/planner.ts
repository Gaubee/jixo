import type {Mastra} from "@mastra/core";
import {Agent} from "@mastra/core/agent";
import {thinkModel} from "../llm/index.js";
import {type LogManager} from "../services/logManager.js";
import {serializeLogFile} from "../services/logSerializer.js";
import {PlannerOutputSchema} from "./schemas.js";

export const plannerAgent = new Agent({
  name: "PlannerAgent",
  instructions: `You are an expert project planner AI. Your job is to analyze the provided context (job goal, current roadmap, and specific planning scenario) and generate a set of instructions to modify the project roadmap.

Your output MUST be a valid JSON object that strictly adheres to the provided schema.

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

export const usePlannerAgent = (
  mastra: Mastra,
  // The specific planning scenario and context.
  planningPrompt: string,
  // Core services and state passed to the agent.
  args: {logManager: LogManager},
) => {
  const {logManager} = args;
  const jobInfo = logManager.getJobInfo();
  const roadmap = logManager.getLogFile().roadmap ?? [];
  const workDir = jobInfo.workDir;
  const jobGoal = jobInfo.jobGoal;

  const roadmapMarkdown = serializeLogFile({info: jobInfo, roadmap, workLog: []}).split("## Roadmap")[1].split("## Work Log")[0].trim();

  const finalPrompt = `
The project's working directory is: \`${workDir}\`. ALL file paths in your plan must be relative to this directory.

### Overall Job Goal
${jobGoal}

### Current Roadmap State
${roadmapMarkdown || "_No tasks planned yet._"}

---

### Your Current Planning Task
${planningPrompt}
`;

  console.log("QAQ plannerAgent", finalPrompt);
  // <!--[[测试到这里很奇怪，这个generate函数调用后，迟迟无法返回结果]]-->
  return mastra.getAgent("plannerAgent").generate(finalPrompt, {
    output: PlannerOutputSchema,
  });
};
