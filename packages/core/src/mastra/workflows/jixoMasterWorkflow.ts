import {delay} from "@gaubee/util";
import {createStep, createWorkflow} from "@mastra/core/workflows";
import {z} from "zod";
import {logManagerFactory} from "../services/logManagerFactory.js";
import {jixoJobWorkflow} from "./jixoJobWorkflow.js";
import {JixoMasterWorkflowInputSchema} from "./schemas.js";

const masterLoopStep = createStep({
  id: "masterLoop",
  inputSchema: JixoMasterWorkflowInputSchema,
  outputSchema: z.object({finalStatus: z.string()}),
  async execute({inputData, mastra}) {
    let loopCount = 0;
    let consecutiveErrors = 0;
    const {jobName, jobGoal, workDir = process.cwd(), maxLoops} = inputData;
    const logManager = await logManagerFactory.getOrCreate(jobName, {jobGoal, workDir});

    while (loopCount < maxLoops) {
      loopCount++;
      await logManager.reload();

      if (logManager.isJobCompleted()) {
        return {finalStatus: "Job completed successfully."};
      }

      console.log(`\n--- JIXO Master Loop #${loopCount} (Consecutive Errors: ${consecutiveErrors}) ---`);
      const runnerId = `runner-${loopCount}`;

      try {
        const jobRun = (mastra.getWorkflow("jixoJobWorkflow") as typeof jixoJobWorkflow).createRun();
        const result = await jobRun.start({inputData: {jobName, jobGoal, runnerId, otherRunners: [], workDir}});

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
