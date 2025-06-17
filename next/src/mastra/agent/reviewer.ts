import {Agent} from "@mastra/core/agent";
import {type RuntimeContext} from "@mastra/core/runtime-context";
import {thinkModel} from "../llm/index.js";
import type {JixoRuntimeContextData} from "../workflows/schemas.js";

export const reviewerAgent = new Agent({
  name: "ReviewerAgent",
  instructions: ({runtimeContext}: {runtimeContext: RuntimeContext<JixoRuntimeContextData>}) => {
    const task = runtimeContext.get("task");
    const checklist = task?.checklist ?? [];
    const executionSummary = runtimeContext.get("executionSummary") ?? "No summary provided.";
    const taskSpecificLogs = runtimeContext.get("taskSpecificLogs") ?? [];
    const recentLogs = taskSpecificLogs
      .slice(0, 5)
      .map((log) => `- ${log.timestamp} [${log.role}] Objective: ${log.objective} -> Result: ${log.result}, Summary: ${log.summary}`)
      .join("\n");

    return `You are a meticulous code reviewer and QA engineer.

### Task to Review
**ID**: ${task?.id}
**Title**: ${task?.title}

### Checklist (Must be fully satisfied)
${checklist.length > 0 ? checklist.map((item) => `- ${item}`).join("\n") : "- No checklist provided."}

### Executor's Summary
${executionSummary}

### Recent Work Log (for context on repetitive errors)
${recentLogs || "No specific logs for this task."}

---

### Your Tasks:
1.  **Verify Checklist**: Go through each item in the checklist. Use the work logs and executor summary as evidence to determine if each criterion is met. You may be provided with file system tools to verify file contents directly.
2.  **Detect Failure Loops**: Analyze the work logs. If you detect a repetitive loop of "fix -> execute -> fail" for the same underlying issue, the team is stuck. In this case, your ONLY response must start with the exact phrase "ABORT:". For example: "ABORT: Repetitive failure cycle detected. The file path corrections are not working."
3.  **Make a Decision**:
    - If ALL checklist items are met, your decision is "approved".
    - If ANY checklist item is not met, your decision is "rejected". Provide concise, actionable feedback listing ONLY the specific checklist items that failed and why.

Your final output MUST be a JSON object.
`;
  },
  model: thinkModel,
});