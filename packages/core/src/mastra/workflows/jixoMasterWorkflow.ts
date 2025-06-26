import {delay} from "@gaubee/util";
import {createStep, createWorkflow} from "@mastra/core/workflows";
import {z} from "zod";
import {isJixoApp, ok} from "../utils.js";
import type {JixoJobWorkflow} from "./jixoJobWorkflow.js";
import {JixoMasterWorkflowInputSchema, JixoMasterWorkflowOutputSchema} from "./schemas.js";

/**
 * This step represents the main control loop for a JIXO job, acting as the "Supervisor" or "Central Nervous System".
 * Its primary responsibility is to orchestrate the execution of the `jixoJobWorkflow` (the "AI Neuron").
 * It manages the macro-level lifecycle of a job, handling retries, loop limits, and final status reporting,
 * while delegating the core cognitive tasks of planning, executing, and reviewing to the `jixoJobWorkflow`.
 */
const masterLoopStep = createStep({
  id: "masterLoop",
  inputSchema: JixoMasterWorkflowInputSchema,
  outputSchema: JixoMasterWorkflowOutputSchema,
  async execute({inputData, mastra, runtimeContext}) {
    ok(isJixoApp(mastra));
    const workspaceManager = mastra.workspaceManager;

    let loopCount = 0;
    let consecutiveErrors = 0;
    const {jobName, jobGoal, jobDir = process.cwd(), maxLoops = 20} = inputData;
    const logManager = await workspaceManager.getOrCreateJobManager(jobName, {jobName, jobGoal, jobDir});

    while (loopCount < maxLoops) {
      loopCount++;
      await logManager.reload();

      if (logManager.isJobCompleted()) {
        return {finalStatus: "Job completed successfully."};
      }

      console.log(`\n--- JIXO Master Loop #${loopCount} (Consecutive Errors: ${consecutiveErrors}) ---`);
      const runnerId = `runner-${loopCount}`;

      try {
        const jobRun = await (mastra.getWorkflow("jixoJobWorkflow") as JixoJobWorkflow).createRunAsync();
        // Pass the runtime context down to sub-workflows/steps
        const result = await jobRun.start({inputData: {jobName, jobGoal, runnerId, otherRunners: [], jobDir}, runtimeContext});

        if (result.status === "failed") {
          consecutiveErrors++;
          console.error(`[Master Loop] Unhandled workflow error: ${result.error}`);
          if (consecutiveErrors >= 3) {
            return {finalStatus: "Job failed: 3 consecutive unhandled workflow errors."};
          }
          await delay(2000);
          continue;
        }
        consecutiveErrors = 0;

        if (result.status === "suspended") throw new Error("Workflow suspended unexpectedly.");

        const {exitCode, reason} = Object.values(result.result)[0];
        console.log(`[Master Loop] Inner cycle finished with code ${exitCode}: ${reason}`);

        if (exitCode === 0) return {finalStatus: "Job completed successfully."};
        if (exitCode === 1) return {finalStatus: `Job failed: ${reason}`};
      } catch (error) {
        consecutiveErrors++;
        console.error(`[Master Loop] Caught exception during inner cycle:`, error);
        if (consecutiveErrors >= 3) {
          return {finalStatus: `Job failed: 3 consecutive unhandled exceptions. Last error: ${error instanceof Error ? error.message : String(error)}`};
        }
      }

      await delay(1500);
    }
    return {finalStatus: "Job stopped: Max loop count reached."};
  },
});

export const jixoMasterWorkflow = createWorkflow({
  id: "jixoMasterWorkflow",
  inputSchema: JixoMasterWorkflowInputSchema,
  outputSchema: z.object({finalStatus: z.string()}),
})
  .then(masterLoopStep)
  .commit();

export type JixoMasterWorkflow = typeof jixoMasterWorkflow;
