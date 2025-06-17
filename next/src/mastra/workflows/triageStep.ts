import {createStep} from "@mastra/core/workflows";
import {DELETE_FIELD_MARKER} from "../entities.js";
import {walkJobRoadmap} from "../services/logHelper.js";
import {logManagerFactory} from "../services/logManagerFactory.js";
import {JixoJobWorkflowInputSchema, TriageOutputSchema, type TriageOutputData} from "./schemas.js";

export const triageStep = createStep({
  id: "triage",
  inputSchema: JixoJobWorkflowInputSchema,
  outputSchema: TriageOutputSchema,
  async execute({inputData}): Promise<TriageOutputData> {
    const logManager = await logManagerFactory.getOrCreate(inputData.jobName, inputData);

    let staleLocksFound = false;
    const otherRunnersIds = new Set(inputData.otherRunners);
    await logManager.reload();

    let currentLog = logManager.getLogFile();
    for (const task of walkJobRoadmap(currentLog.roadmap)) {
      if (task.status === "Locked" && task.executor && !otherRunnersIds.has(task.executor)) {
        await logManager.updateTask(task.id, {status: "Pending", executor: DELETE_FIELD_MARKER as any});
        staleLocksFound = true;
      }
    }
    if (staleLocksFound) {
      await logManager.reload();
      currentLog = logManager.getLogFile();
    }

    if (!currentLog.roadmap.length) {
      return {action: "plan", planningContext: {type: "initial"}};
    }

    const failedTask = logManager.findTask((t) => t.status === "Failed");
    if (failedTask) {
      return {action: "plan", planningContext: {type: "fixFailure", task: failedTask}};
    }

    const taskToReview = logManager.findTask((t) => t.status === "PendingReview");
    if (taskToReview) {
      return {action: "review", task: taskToReview};
    }

    const taskForRework = logManager.findTask((t) => t.status === "Pending" && t.reworkReason != null);
    if (taskForRework) {
      return {action: "plan", planningContext: {type: "rework", task: taskForRework}};
    }

    const {type, task: actionableTask} = logManager.getNextActionableTask();
    if (type === "execute") {
      return {action: "execute", task: actionableTask!};
    }

    if (logManager.isJobCompleted()) {
      return {action: "exit", exitInfo: {exitCode: 0, reason: "All tasks completed."}};
    }

    const isOtherRunnerActive = logManager.findTask((t) => t.status === "Locked" && inputData.otherRunners.includes(t.executor || ""));
    if (isOtherRunnerActive) {
      return {action: "exit", exitInfo: {exitCode: 2, reason: "No tasks ready to execute. Other runners are active."}};
    }

    return {action: "exit", exitInfo: {exitCode: 1, reason: "Job failed: Deadlock detected. No actionable tasks and no active runners."}};
  },
});
