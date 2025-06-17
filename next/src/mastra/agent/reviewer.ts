import type {Mastra} from "@mastra/core";
import {Agent} from "@mastra/core/agent";
import {type RuntimeContext} from "@mastra/core/runtime-context";
import {thinkModel} from "../llm/index.js";
import type {ReviewerRuntimeContextData} from "../workflows/schemas.js";
import {ReviewResultSchema} from "./schemas.js";

export const reviewerAgent = new Agent({
  name: "ReviewerAgent",
  instructions: `You are a meticulous code reviewer and QA engineer. You will be provided with all the context for a task that was just completed.

### Your Tasks:
1.  **Verify Checklist**: Carefully review the task's checklist against the executor's summary and work logs.
2.  **Detect Failure Loops**: Analyze the work logs for repetitive failure cycles. If found, your response MUST start with the exact phrase "ABORT:".
3.  **Make a Decision**:
    - If ALL checklist items are met, your decision is "approved".
    - If ANY checklist item is not met, your decision is "rejected". Provide concise, actionable feedback.

Your final output MUST be a JSON object.`,
  model: thinkModel,
});

export const useReviewerAgent = (mastra: Mastra, args: {runtimeContext: RuntimeContext<ReviewerRuntimeContextData>}) => {
  const {runtimeContext} = args;
  const task = runtimeContext.get("task");
  const executionSummary = runtimeContext.get("executionSummary");
  const taskSpecificLogs = runtimeContext.get("taskSpecificLogs");

  const recentLogs = taskSpecificLogs
    .slice(0, 5)
    .map((log) => `- ${log.timestamp} [${log.role}] Objective: ${log.objective} -> Result: ${log.result}, Summary: ${log.summary}`)
    .join("\n");

  const prompt = `
### Task to Review
**ID**: ${task.id}
**Title**: ${task.title}

### Checklist (Must be fully satisfied)
${task.checklist || "_No checklist provided._"}

### Executor's Summary
${executionSummary}

### Recent Work Log (for context on repetitive errors)
${recentLogs || "_No specific logs for this task._"}

---

Please provide your review based on the information above.
`;

  return mastra.getAgent("reviewerAgent").generate(prompt, {
    output: ReviewResultSchema,
    runtimeContext, // Tools (if any) might need the logManager from context
  });
};
