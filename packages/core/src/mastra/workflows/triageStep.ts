import {createStep} from "@mastra/core/workflows";
import {DELETE_FIELD_MARKER, type WorkLogEntryData} from "../entities.js";
import {walkJobRoadmap} from "../services/logHelper.js";
import {isJixoApp, ok} from "../utils.js";
import {JixoJobWorkflowInputSchema, TriageOutputSchema, type TriageOutputData} from "./schemas.js";

/**
 * Analyzes the summary of a failed work log entry to classify the error type.
 * @param failedLog The work log entry for the failed task.
 * @returns An object containing the classified error type and the summary.
 */
function analyzeFailure(failedLog: WorkLogEntryData | undefined): {errorType: "transient" | "code_error" | "unknown"; errorSummary: string} {
  const summary = failedLog?.summary?.toLowerCase() ?? "";
  if (!summary) return {errorType: "unknown", errorSummary: "Unknown error."};

  // Keywords indicating transient, non-code related issues.
  const transientKeywords = ["quota", "timeout", "network error", "api limit", "service unavailable"];
  if (transientKeywords.some((kw) => summary.includes(kw))) {
    return {errorType: "transient", errorSummary: summary};
  }

  // Assume other errors are code-related for now. This can be expanded later.
  return {errorType: "code_error", errorSummary: summary};
}

export const triageStep = createStep({
  id: "triage",
  inputSchema: JixoJobWorkflowInputSchema,
  outputSchema: TriageOutputSchema,
  async execute({inputData, mastra}): Promise<TriageOutputData> {
    ok(isJixoApp(mastra));

    const workspaceManager = mastra.workspaceManager;

    const logManager = await workspaceManager.getOrCreateJobManager(inputData.jobName, inputData);

    // --- Stale Lock Handling ---
    let staleLocksFound = false;
    const otherRunnersIds = new Set(inputData.otherRunners);
    await logManager.reload();

    // Check for tasks locked by non-active runners and reset them.
    for (const task of walkJobRoadmap(logManager.getLogFile().roadmap)) {
      if (task.status === "Locked" && task.executor && !otherRunnersIds.has(task.executor)) {
        await logManager.updateTask(task.id, {status: "Pending", executor: DELETE_FIELD_MARKER});
        staleLocksFound = true;
      }
    }
    // If locks were cleared, reload the state to ensure consistency for the next steps.
    if (staleLocksFound) {
      await logManager.reload();
    }

    const currentLog = logManager.getLogFile();

    // --- Triage Logic ---
    // 1. Initial Planning: If the roadmap is empty, the first action must be to plan.
    if (!currentLog.roadmap.length) {
      return {action: "plan", planningContext: {type: "initial"}};
    }

    // 2. Failure Recovery: Prioritize fixing failed tasks.
    const failedTask = logManager.findTask((t) => t.status === "Failed");
    if (failedTask) {
      const failureLog = currentLog.workLog.find((w) => w.objective.includes(failedTask.id) && w.result === "Failed");
      const {errorType, errorSummary} = analyzeFailure(failureLog);
      return {action: "plan", planningContext: {type: "fixFailure", task: failedTask, errorType, errorSummary}};
    }

    // 3. Review: Handle tasks that have been executed and are pending review.
    const taskToReview = logManager.findTask((t) => t.status === "PendingReview");
    if (taskToReview) {
      return {action: "review", task: taskToReview};
    }

    // 4. Rework: Address tasks that were rejected by a reviewer.
    const taskForRework = logManager.findTask((t) => t.status === "Pending" && t.reworkReason != null);
    if (taskForRework) {
      return {action: "plan", planningContext: {type: "rework", task: taskForRework}};
    }

    // 5. Execution: Find the next available task to execute.
    const {type, task: actionableTask} = logManager.getNextActionableTask();
    if (type === "execute") {
      return {action: "execute", task: actionableTask!};
    }

    // --- Exit Condition Analysis ---
    // 6. Job Completion: If no actionable tasks are left and the job is complete.
    if (logManager.isJobCompleted()) {
      return {action: "exit", exitInfo: {exitCode: 0, reason: "All tasks completed."}};
    }

    // 7. Standby: If there are no pending tasks but others are active, wait.
    const isOtherRunnerActive = logManager.findTask((t) => t.status === "Locked" && inputData.otherRunners.includes(t.executor || ""));
    if (isOtherRunnerActive) {
      return {action: "exit", exitInfo: {exitCode: 2, reason: "No tasks ready to execute. Other runners are active."}};
    }

    // 8. Deadlock/Failure: If no tasks are actionable, job is not done, and no one is working.
    return {action: "exit", exitInfo: {exitCode: 1, reason: "Job failed: Deadlock detected. No actionable tasks and no active runners."}};
  },
});
