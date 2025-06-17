import {RuntimeContext} from "@mastra/core/runtime-context";
import {createStep} from "@mastra/core/workflows";
import {ExecutionResultSchema} from "../agent/index.js";
import {DELETE_FIELD_MARKER} from "../entities.js";
import {logManagerFactory} from "../services/logManagerFactory.js";
import {JixoJobWorkflowExitInfoSchema, JixoJobWorkflowInputSchema, type JixoRuntimeContextData, TriageExecuteSchema} from "./schemas.js";

export const executionStep = createStep({
  id: "execution",
  inputSchema: TriageExecuteSchema,
  outputSchema: JixoJobWorkflowExitInfoSchema,
  async execute({inputData, mastra, getInitData}) {
    const init = getInitData<typeof JixoJobWorkflowInputSchema>();
    const task = inputData.task!;
    const logManager = await logManagerFactory.getOrCreate(init.jobName);

    const runtimeContext = new RuntimeContext<JixoRuntimeContextData>();
    runtimeContext.set("jobName", init.jobName);
    runtimeContext.set("jobGoal", init.jobGoal);
    runtimeContext.set("workDir", init.workDir);
    runtimeContext.set("task", task);
    // Provide the last 3 logs for context
    runtimeContext.set("recentWorkLog", inputData.log.workLog.slice(0, 3));

    try {
      await logManager.updateTask(task.id, {status: "Locked", executor: init.runnerId});

      const result = await mastra.getAgent("executorAgent").generate(`Task: ${task.title}. Details: ${task.details ?? "N/A"}`, {
        output: ExecutionResultSchema,
        runtimeContext,
      });

      const executionResult = result.object;

      if (executionResult.outcome === "failure") {
        throw new Error(executionResult.errorMessage ?? "Executor reported a failure without an error message.");
      }

      if (task.gitCommit) {
        // Standardized commit message format
        const commitMessage = `feat(task-${task.id}): ${task.title}\n\n${executionResult.summary}`;
        console.log(`[Executor] Simulating: git commit -m "${commitMessage}"`);
      }

      await logManager.updateTask(task.id, {status: "PendingReview", executor: DELETE_FIELD_MARKER as any});
      await logManager.addWorkLog({
        timestamp: new Date().toISOString(),
        runnerId: init.runnerId,
        role: "Executor",
        objective: `Execute task ${task.id}`,
        result: "Succeeded",
        summary: executionResult.summary,
      });
      return {exitCode: 2, reason: `Task ${task.id} executed, now pending review.`};
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[Executor] Task ${task.id} failed:`, errorMessage);
      await logManager.updateTask(task.id, {status: "Failed"});
      await logManager.addWorkLog({
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