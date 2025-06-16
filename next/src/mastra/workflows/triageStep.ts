import {createStep} from "@mastra/core/workflows";
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

    if (!log.roadmap.length) {
      return {action: "plan", log, planningContext: {type: "initial"}};
    }

    const failedTask = await logManager.findTask((t) => t.status === "Failed", inputData.jobName);
    if (failedTask) {
      return {action: "plan", log, planningContext: {type: "fixFailure", task: failedTask}};
    }

    const taskToReview = await logManager.findTask((t) => t.status === "PendingReview", inputData.jobName);
    if (taskToReview) {
      return {action: "review", log, task: taskToReview};
    }

    const taskForRework = await logManager.findTask((t) => t.status === "Pending" && t.details?.startsWith(REWORK_MARKER), inputData.jobName);
    if (taskForRework) {
      return {action: "plan", log, planningContext: {type: "rework", task: taskForRework}};
    }

    const {type, task: actionableTask} = await logManager.getNextActionableTask(inputData.jobName);
    if (type === "execute") {
      return {action: "execute", log, task: actionableTask!};
    }

    if (isJobCompleted(log)) {
      return {action: "exit", log, exitInfo: {exitCode: 0, reason: "All tasks completed."}};
    }
    return {action: "exit", log, exitInfo: {exitCode: 2, reason: "No tasks ready to execute. Standby."}};
  },
});
