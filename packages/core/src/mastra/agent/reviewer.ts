import type {Mastra} from "@mastra/core";
import {Agent} from "@mastra/core/agent";
import {type RuntimeContext} from "@mastra/core/runtime-context";
import {Memory} from "@mastra/memory";
import {thinkModel} from "../llm/index.js";
import {tools} from "../tools/index.js";
import type {ReviewerRuntimeContextData} from "../workflows/schemas.js";
import type {CreateAgentOptions} from "./common.js";
import {ReviewResultSchema} from "./schemas.js";

export const createReviewerAgent = async ({workDir, memoryStorage}: CreateAgentOptions) => {
  const reviewerAgent = new Agent({
    name: "ReviewerAgent",
    instructions: `You are a meticulous and skeptical QA engineer. Your job is to verify, not to trust.

### CRITICAL Directives:
1.  **MANDATORY Verification**: You **MUST** use tools to verify the task's completion. For any checklist item involving files or system state, you **MUST** use tools like \`fs_read_file\` to inspect the artifacts directly.
2.  **NEVER Trust Summaries**: Do **NOT** approve a task based solely on the executor's summary or work logs. These are context, not proof. Your decision must be based on physical evidence obtained through tool calls.
3.  **Decision Logic**:
    - If ALL checklist items are physically verified via tools, your decision is "approved".
    - If ANY checklist item fails verification, your decision is "rejected". Provide a concise, actionable reason in the feedback field.
4.  **Failure Loop Detection**: Analyze work logs for repetitive failures. If a loop is detected, your response MUST start with the exact phrase "ABORT:".

Your final output **MUST** be a single, valid JSON object.`,
    model: thinkModel,
    memory: new Memory({
      options: {
        workingMemory: {
          enabled: true,
        },
      },
    }),
    tools: {
      ...(await tools.fileSystem(workDir)),
      ...(await tools.git(workDir)),
    },
  });
  return reviewerAgent;
};
export type ReviewerAgent = Awaited<ReturnType<typeof createReviewerAgent>>;

export const useReviewerAgent = async (app: Mastra, args: {runtimeContext: RuntimeContext<ReviewerRuntimeContextData>}) => {
  const {runtimeContext} = args;
  const task = runtimeContext.get("task");
  const executionSummary = runtimeContext.get("executionSummary");
  const taskSpecificLogs = runtimeContext.get("taskSpecificLogs");
  const logManager = runtimeContext.get("logManager");
  const jobInfo = logManager.getJobInfo();

  const recentLogs = taskSpecificLogs
    .slice(0, 5)
    .map((log) => `- ${log.timestamp} [${log.role}] Objective: ${log.objective} -> Result: ${log.result}, Summary: ${log.summary}`)
    .join("\n");

  const prompt = `
### Task to Review
**ID**: ${task.id}
**Title**: ${task.title}

### Checklist (Must be fully satisfied)
${task.checklist?.map((item) => `- ${item}`).join("\n") || "_No checklist provided._"}

### Executor's Summary
${executionSummary}

### Recent Work Log (for context on repetitive errors)
${recentLogs || "No specific logs for this task."}

---

Please provide your review based on the information above. Use your file system tools to verify file-related checklist items.
`;

  return app.getAgent("reviewerAgent").generate(prompt, {
    output: ReviewResultSchema,
    runtimeContext,
  });
};
