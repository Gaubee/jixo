import {RuntimeContext} from "@mastra/core/runtime-context";
import {createStep} from "@mastra/core/workflows";
import assert from "node:assert";
import {useExecutorAgent} from "../agent/executor.js";
import {isJixoApp} from "../app.js";
import {DELETE_FIELD_MARKER} from "../entities.js";
import {logManagerFactory} from "../services/logManagerFactory.js";
import {JixoJobWorkflowExitInfoSchema, JixoJobWorkflowInputSchema, TriageExecuteSchema, type ExecutorRuntimeContextData} from "./schemas.js";

export const executionStep = createStep({
  id: "execution",
  inputSchema: TriageExecuteSchema,
  outputSchema: JixoJobWorkflowExitInfoSchema,
  async execute({inputData, mastra, getInitData}) {
    assert.ok(isJixoApp(mastra));

    const init = getInitData<typeof JixoJobWorkflowInputSchema>();
    const task = inputData.task!;
    const logManager = await logManagerFactory.getOrCreate(init.jobName, init);
    const currentLog = logManager.getLogFile();

    const runtimeContext = new RuntimeContext<ExecutorRuntimeContextData>([
      ["logManager", logManager],
      ["task", task],
      ["recentWorkLog", currentLog.workLog.slice(0, 3)],
      ["gitCommit", init.gitCommit],
    ]);

    try {
      await logManager.updateTask(task.id, {status: "Locked", executor: init.runnerId});

      const result = await useExecutorAgent(mastra, {runtimeContext});
      const executionResult = result.object;

      if (executionResult.outcome === "failure") {
        throw new Error(executionResult.errorMessage ?? "Executor reported a failure without an error message.");
      }

      await logManager.updateTask(task.id, {status: "PendingReview", executor: DELETE_FIELD_MARKER});
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
