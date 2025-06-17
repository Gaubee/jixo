import {createStep} from "@mastra/core/workflows";
import {logManager} from "../services/logManager.js";
import {JixoJobWorkflowExitInfoSchema, JixoJobWorkflowInputSchema, TriageReviewSchema} from "./schemas.js";
import {REWORK_MARKER} from "./utils.js";

export const reviewStep = createStep({
  id: "review",
  inputSchema: TriageReviewSchema,
  outputSchema: JixoJobWorkflowExitInfoSchema,
  async execute({inputData, mastra, getInitData}) {
    const init = getInitData<typeof JixoJobWorkflowInputSchema>();
    const task = inputData.task!;

    // Provide context: the last 5 work log entries
    const recentLogs = inputData.log.workLog
      .slice(0, 5)
      .map((log) => `- ${log.timestamp} [${log.role}] Objective: ${log.objective} -> Result: ${log.result}, Summary: ${log.summary}`)
      .join("\n");
    const executorSummary = inputData.log.workLog[0].summary;

    const prompt = `
Task to Review: ${task.id} ${task.title}
Executor's Summary: ${executorSummary}

Recent Work Log (for context on repetitive errors):
${recentLogs}

Based on all the above, does the work meet the task's objective?
    `.trim();

    const result = await mastra.getAgent("reviewerAgent").generate(prompt);
    const resultText = result.text.trim();

    if (resultText.startsWith("ABORT:")) {
      // The reviewer has detected a fatal loop and aborted.
      await logManager.addWorkLog(init.jobName, {
        timestamp: new Date().toISOString(),
        runnerId: init.runnerId,
        role: "Reviewer",
        objective: `Review task ${task.id}`,
        result: "Failed",
        summary: `Reviewer aborted job: ${resultText}`,
      });
      // This exit code will terminate the master workflow.
      return {exitCode: 1, reason: `Reviewer aborted job: ${resultText}`};
    }

    if (resultText.toLowerCase() === "approved") {
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
