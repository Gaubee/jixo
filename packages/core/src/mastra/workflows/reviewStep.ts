import {RuntimeContext} from "@mastra/core/runtime-context";
import {createStep} from "@mastra/core/workflows";
import {useReviewerAgent} from "../agent/reviewer.js";
import {DELETE_FIELD_MARKER, type WorkLogEntryData} from "../entities.js";
import {isJixoApp, ok} from "../utils.js";
import {JixoJobWorkflowExitInfoSchema, JixoJobWorkflowInputSchema, type ReviewerRuntimeContextData, TriageReviewSchema} from "./schemas.js";

/**
 * The "Review" phase of the P-E-R "AI Neuron".
 * This step has a critical dual responsibility:
 * 1.  **Quality Gate**: It verifies that the output of the `executionStep` meets
 *     the acceptance criteria defined in the task's `checklist`.
 * 2.  **Evolution Engine**: It generates metrics and feedback on the performance
 *     of the P-E-R cycle. This data is the foundation for JIXO's future
 *     self-improvement and learning capabilities ("fluid-intelligence" and "solid-intelligence").
 */
export const reviewStep = createStep({
  id: "review",
  inputSchema: TriageReviewSchema,
  outputSchema: JixoJobWorkflowExitInfoSchema,
  async execute({inputData, mastra, getInitData}) {
    ok(isJixoApp(mastra));
    const workspaceManager = mastra.workspaceManager;

    const init = getInitData<typeof JixoJobWorkflowInputSchema>();
    const task = inputData.task!;
    const logManager = await workspaceManager.getOrCreateJobManager(init.jobName, init);
    const currentLog = logManager.getLogFile();

    const taskSpecificLogs = currentLog.workLog.filter((log: WorkLogEntryData) => log.objective.includes(`task ${task.id}`));
    const executorSummary = taskSpecificLogs.find((log: WorkLogEntryData) => log.role === "Executor")?.summary || "No summary found.";

    const runtimeContext = new RuntimeContext<ReviewerRuntimeContextData>([
      ["logManager", logManager],
      ["task", task],
      ["taskSpecificLogs", taskSpecificLogs],
      ["executionSummary", executorSummary],
    ]);

    try {
      const reviewResult = await useReviewerAgent(mastra, {runtimeContext});

      if (reviewResult.feedback?.startsWith("ABORT:")) {
        await logManager.addWorkLog({
          timestamp: new Date().toISOString(),
          runnerId: init.runnerId,
          role: "Reviewer",
          objective: `Review task ${task.id}`,
          result: "Failed",
          summary: `Reviewer aborted job: ${reviewResult.feedback}`,
        });
        return {exitCode: 1, reason: `Reviewer aborted job: ${reviewResult.feedback}`};
      }

      if (reviewResult.decision === "approved") {
        await logManager.updateTask(task.id, {status: "Completed", reviewer: init.runnerId, reworkReason: DELETE_FIELD_MARKER});
        await logManager.addWorkLog({
          timestamp: new Date().toISOString(),
          runnerId: init.runnerId,
          role: "Reviewer",
          objective: `Review task ${task.id}`,
          result: "Succeeded",
          summary: "Approved.",
        });
        return {exitCode: 2, reason: `Task ${task.id} approved.`};
      } else {
        await logManager.updateTask(task.id, {status: "Pending", reworkReason: reviewResult.feedback, executor: DELETE_FIELD_MARKER});
        await logManager.addWorkLog({
          timestamp: new Date().toISOString(),
          runnerId: init.runnerId,
          role: "Reviewer",
          objective: `Review task ${task.id}`,
          result: "Failed",
          summary: `Requires rework. Feedback: ${reviewResult.feedback}`,
        });
        return {exitCode: 2, reason: `Task ${task.id} requires rework.`};
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[Reviewer] Review for task ${task.id} failed with an exception:`, errorMessage);
      await logManager.updateTask(task.id, {status: "Pending", reworkReason: `Review process failed: ${errorMessage}`, executor: DELETE_FIELD_MARKER});
      await logManager.addWorkLog({
        timestamp: new Date().toISOString(),
        runnerId: init.runnerId,
        role: "Reviewer",
        objective: `Review task ${task.id}`,
        result: "Failed",
        summary: `Review step crashed: ${errorMessage}`,
      });
      return {exitCode: 2, reason: `Review for task ${task.id} failed.`};
    }
  },
});
