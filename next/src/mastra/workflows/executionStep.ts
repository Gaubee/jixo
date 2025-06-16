import {createStep} from "@mastra/core/workflows";
import {RuntimeContext} from "@mastra/core/runtime-context";
import {logManager} from "../services/logManager.js";
import {JixoJobWorkflowExitInfoSchema, JixoJobWorkflowInputSchema, TriageOutputSchema} from "./schemas.js";

export const executionStep = createStep({
  id: "execution",
  inputSchema: TriageOutputSchema,
  outputSchema: JixoJobWorkflowExitInfoSchema,
  async execute({inputData, mastra, getInitData}) {
    const init = getInitData<typeof JixoJobWorkflowInputSchema>();
    const task = inputData.task!;

    const runtimeContext = new RuntimeContext();
    runtimeContext.set("cwd", init.workDir);

    try {
      await logManager.updateTask(init.jobName, task.id, {status: "Locked", executor: init.runnerId});
      const result = await mastra.getAgent("executorAgent").generate(`Task: ${task.title}. Details: ${task.details ?? "N/A"}`, {runtimeContext});

      if (task.gitCommit) {
        // Standardized commit message format
        const commitMessage = `feat(task-${task.id}): ${task.title}\n\n${result.text}`;
        console.log(`[Executor] Simulating: git commit -m "${commitMessage}"`);
      }

      await logManager.updateTask(init.jobName, task.id, {status: "PendingReview"});
      await logManager.addWorkLog(init.jobName, {
        timestamp: new Date().toISOString(),
        runnerId: init.runnerId,
        role: "Executor",
        objective: `Execute task ${task.id}`,
        result: "Succeeded",
        summary: result.text,
      });
      return {exitCode: 2, reason: `Task ${task.id} executed, now pending review.`};
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[Executor] Task ${task.id} failed:`, errorMessage);
      await logManager.updateTask(init.jobName, task.id, {status: "Failed"});
      await logManager.addWorkLog(init.jobName, {
        timestamp: new Date().toISOString(),
        runnerId: init.runnerId,
        role: "Executor",
        objective: `Execute task ${task.id}`,
        result: "Failed",
        summary: errorMessage,
      });
      return {exitCode: 2, reason: `Task ${task.id} failed and was logged.`};
    }
  },
});