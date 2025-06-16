import {createStep, createWorkflow} from "@mastra/core/workflows";
import {z} from "zod";
import {logManager} from "../services/logManager.js";
import {planningStep} from "./planningStep.js";
import {JixoJobWorkflowExitInfoSchema, JixoJobWorkflowInputSchema, TriageOutputSchema} from "./schemas.js";
import {triageStep} from "./triageStep.js";
import {REWORK_MARKER} from "./utils.js";
import{executionStep}from './executionStep.js'

export const reviewStep = createStep({
  id: "review",
  inputSchema: TriageOutputSchema,
  outputSchema: JixoJobWorkflowExitInfoSchema,
  async execute({inputData, mastra, getInitData}) {
    const init = getInitData<typeof JixoJobWorkflowInputSchema>();
    const task = inputData.task!;
    const lastWorkLog = inputData.log.workLog[0];

    const result = await mastra.getAgent("reviewerAgent").generate(`Task Title: ${task.title}\nExecutor's Summary: ${lastWorkLog.summary}\n\nDoes this meet the objective?`);

    if (result.text.trim().toLowerCase() === "approved") {
      await logManager.updateTask(init.jobName, task.id, {status: "Completed", reviewer: init.runnerId});
      await logManager.addWorkLog(init.jobName, {
        timestamp: new Date().toISOString(),
        runnerId: init.runnerId,
        role: "Reviewer",
        objective: `Review task ${task.id}`,
        result: "Succeeded",
        summary: "Approved.",
      });
      return {exitCode: 2, reason: `Task ${task.id} approved.`};
    } else {
      const reworkDetails = `${REWORK_MARKER}:\n${result.text}`;
      await logManager.updateTask(init.jobName, task.id, {status: "Pending", details: reworkDetails});
      await logManager.addWorkLog(init.jobName, {
        timestamp: new Date().toISOString(),
        runnerId: init.runnerId,
        role: "Reviewer",
        objective: `Review task ${task.id}`,
        result: "Failed",
        summary: `Requires rework. Feedback: ${result.text}`,
      });
      return {exitCode: 2, reason: `Task ${task.id} requires rework.`};
    }
  },
});