import {createStep} from "@mastra/core/workflows";
import {DELETE_FIELD_MARKER} from "../entities.js";
import {isJobCompleted} from "../services/logHelper.js";
import {logManager} from "../services/logManager.js";
import {JixoJobWorkflowInputSchema, TriageOutputSchema, type TriageOutputData} from "./schemas.js";
import {REWORK_MARKER} from "./utils.js";

export const triageStep = createStep({
  id: "triage",
  inputSchema: JixoJobWorkflowInputSchema,
  outputSchema: TriageOutputSchema,
  async execute({inputData}): Promise<TriageOutputData> {
    const log = await logManager.getLogFile(inputData.jobName);

    // --- Stale Lock Handling ---
    let staleLocksFound = false;
    const activeRunnerIds = new Set([inputData.runnerId, ...inputData.otherRunners]);
    for (const task of log.roadmap) {
      if (task.status === "Locked" && task.executor && !activeRunnerIds.has(task.executor)) {
        await logManager.updateTask(inputData.jobName, task.id, {status: "Pending", executor: DELETE_FIELD_MARKER});
        staleLocksFound = true;
      }
      for (const subTask of task.children) {
        if (subTask.status === "Locked" && subTask.executor && !activeRunnerIds.has(subTask.executor)) {
          await logManager.updateTask(inputData.jobName, subTask.id, {status: "Pending", executor: DELETE_FIELD_MARKER});
          staleLocksFound = true;
        }
      }
    }
    // If we found stale locks, re-read the log file to get the fresh state before proceeding.
    const currentLog = staleLocksFound ? await logManager.getLogFile(inputData.jobName) : log;

    // --- Triage Logic ---
    if (!currentLog.roadmap.length) {
      return {action: "plan", log: currentLog, planningContext: {type: "initial"}};
    }

    const failedTask = await logManager.findTask((t) => t.status === "Failed", inputData.jobName);
    if (failedTask) {
      return {action: "plan", log: currentLog, planningContext: {type: "fixFailure", task: failedTask}};
    }

    const taskToReview = await logManager.findTask((t) => t.status === "PendingReview", inputData.jobName);
    if (taskToReview) {
      return {action: "review", log: currentLog, task: taskToReview};
    }

    const taskForRework = await logManager.findTask((t) => t.status === "Pending" && t.details?.startsWith(REWORK_MARKER), inputData.jobName);
    if (taskForRework) {
      return {action: "plan", log: currentLog, planningContext: {type: "rework", task: taskForRework}};
    }

    const {type, task: actionableTask} = await logManager.getNextActionableTask(inputData.jobName);
    if (type === "execute") {
      return {action: "execute", log: currentLog, task: actionableTask!};
    }

    // --- Exit Condition Analysis ---
    if (isJobCompleted(currentLog)) {
      return {action: "exit", log: currentLog, exitInfo: {exitCode: 0, reason: "All tasks completed."}};
    }

    // Check if other runners are active on any locked tasks
    const isOtherRunnerActive = await logManager.findTask((t) => t.status === "Locked" && inputData.otherRunners.includes(t.executor || ""), inputData.jobName);
    if (isOtherRunnerActive) {
      return {action: "exit", log: currentLog, exitInfo: {exitCode: 2, reason: "No tasks ready to execute. Other runners are active."}};
    }

    // If no tasks are actionable, the job isn't complete, and no one else is working, it's a deadlock/failure.
    return {action: "exit", log: currentLog, exitInfo: {exitCode: 1, reason: "Job failed: Deadlock detected. No actionable tasks and no active runners."}};
  },
});
