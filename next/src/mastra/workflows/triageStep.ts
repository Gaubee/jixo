import {createStep} from "@mastra/core/workflows";
import {DELETE_FIELD_MARKER} from "../entities.js";
import {walkJobRoadmap} from "../services/logHelper.js";
import {logManagerFactory} from "../services/logManagerFactory.js";
import {JixoJobWorkflowInputSchema, TriageOutputSchema, type TriageOutputData} from "./schemas.js";
import {REWORK_MARKER} from "./utils.js";

export const triageStep = createStep({
  id: "triage",
  inputSchema: JixoJobWorkflowInputSchema,
  outputSchema: TriageOutputSchema,
  async execute({inputData}): Promise<TriageOutputData> {
    const logManager = await logManagerFactory.getOrCreate(inputData.jobName);

    // --- Stale Lock Handling ---
    let staleLocksFound = false;
    const otherRunnersIds = new Set(inputData.otherRunners);
    // Reload to ensure we have the latest state before checking locks
    await logManager.reload();
    let currentLog = logManager.getLogFile();

    for (const task of walkJobRoadmap(currentLog.roadmap)) {
      if (task.status === "Locked" && task.executor && !otherRunnersIds.has(task.executor)) {
        await logManager.updateTask(task.id, {status: "Pending", executor: DELETE_FIELD_MARKER as any});
        staleLocksFound = true;
      }
    }
    // If we found stale locks, re-read the log file to get the fresh state before proceeding.
    if (staleLocksFound) {
      await logManager.reload();
      currentLog = logManager.getLogFile();
    }

    // --- Triage Logic ---
    if (!currentLog.roadmap.length) {
      return {action: "plan", log: currentLog, planningContext: {type: "initial"}};
    }

    const failedTask = logManager.findTask((t) => t.status === "Failed");
    if (failedTask) {
      return {action: "plan", log: currentLog, planningContext: {type: "fixFailure", task: failedTask}};
    }

    const taskToReview = logManager.findTask((t) => t.status === "PendingReview");
    if (taskToReview) {
      return {action: "review", log: currentLog, task: taskToReview};
    }

    const taskForRework = logManager.findTask((t) => t.status === "Pending" && t.details?.startsWith(REWORK_MARKER));
    if (taskForRework) {
      return {action: "plan", log: currentLog, planningContext: {type: "rework", task: taskForRework}};
    }

    const {type, task: actionableTask} = logManager.getNextActionableTask();
    if (type === "execute") {
      return {action: "execute", log: currentLog, task: actionableTask!};
    }

    // --- Exit Condition Analysis ---
    if (logManager.isJobCompleted()) {
      return {action: "exit", log: currentLog, exitInfo: {exitCode: 0, reason: "All tasks completed."}};
    }

    // Check if other runners are active on any locked tasks
    const isOtherRunnerActive = logManager.findTask((t) => t.status === "Locked" && inputData.otherRunners.includes(t.executor || ""));
    if (isOtherRunnerActive) {
      return {action: "exit", log: currentLog, exitInfo: {exitCode: 2, reason: "No tasks ready to execute. Other runners are active."}};
    }

    // If no tasks are actionable, the job isn't complete, and no one else is working, it's a deadlock/failure.
    return {action: "exit", log: currentLog, exitInfo: {exitCode: 1, reason: "Job failed: Deadlock detected. No actionable tasks and no active runners."}};
  },
});
