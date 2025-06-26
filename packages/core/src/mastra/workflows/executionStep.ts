import {RuntimeContext} from "@mastra/core/runtime-context";
import {createStep} from "@mastra/core/workflows";
import {useExecutorAgent} from "../agent/executor.js";
import {DELETE_FIELD_MARKER} from "../entities.js";
import {isJixoApp, ok} from "../utils.js";
import {JixoJobWorkflowExitInfoSchema, JixoJobWorkflowInputSchema, TriageExecuteSchema, type ExecutorRuntimeContextData} from "./schemas.js";

/**
 * The "Execute" phase of the P-E-R "AI Neuron".
 * This step takes a single, well-defined task from the roadmap and uses the
 * ExecutorAgent to carry it out. The agent's primary function is to call
 * tools (e.g., file system operations, shell commands) to achieve the task's
 * objectives as described in its `details`.
 */
export const executionStep = createStep({
  id: "execution",
  inputSchema: TriageExecuteSchema,
  outputSchema: JixoJobWorkflowExitInfoSchema,
  async execute({inputData, mastra, getInitData}) {
    ok(isJixoApp(mastra));
    const workspaceManager = mastra.workspaceManager;

    const init = getInitData<typeof JixoJobWorkflowInputSchema>();
    const task = inputData.task!;
    const logManager = await workspaceManager.getOrCreateJobManager(init.jobName, init);
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
