import {delay} from "@gaubee/util";
import {createStep, createWorkflow} from "@mastra/core/workflows";
import {z} from "zod";
import {isJobCompleted} from "../services/logHelper.js";
import {logManager} from "../services/logManager.js";
import {jixoJobWorkflow} from "./jixoJobWorkflow.js";

const JixoMasterWorkflowInputSchema = z.object({
  jobName: z.string(),
  jobGoal: z.string(),
  maxLoops: z.number().default(20),
});

const masterLoopStep = createStep({
  id: "masterLoop",
  inputSchema: JixoMasterWorkflowInputSchema,
  outputSchema: z.object({finalStatus: z.string()}),
  async execute({inputData, mastra}) {
    let loopCount = 0;
    let consecutiveErrors = 0;
    const workDir = process.cwd(); // Get the CWD once here
    await logManager.init(inputData.jobName, {workDir});

    while (loopCount < inputData.maxLoops) {
      loopCount++;
      const logData = await logManager.getLogFile(inputData.jobName);
      if (isJobCompleted(logData)) {
        return {finalStatus: "Job completed successfully."};
      }

      console.log(`\n--- JIXO Master Loop #${loopCount} (Consecutive Errors: ${consecutiveErrors}) ---`);
      const runnerId = `runner-${loopCount}`;

      try {
        const jobRun = (mastra.getWorkflow("jixoJobWorkflow") as typeof jixoJobWorkflow).createRun();
        const result = await jobRun.start({inputData: {jobName: inputData.jobName, jobGoal: inputData.jobGoal, runnerId, otherRunners: [], workDir}});

        if (result.status === "failed") {
          // This case handles errors within the workflow step logic itself
          consecutiveErrors++;
          console.error(`[Master Loop] Unhandled workflow error: ${result.error}`);
          if (consecutiveErrors >= 3) {
            return {finalStatus: "Job failed: 3 consecutive unhandled workflow errors."};
          }
          await delay(2000); // Wait before retrying
          continue;
        }
        consecutiveErrors = 0; // Reset on success

        if (result.status === "suspended") throw new Error("Workflow suspended unexpectedly.");

        const {exitCode, reason} = Object.values(result.result)[0];
        console.log(`[Master Loop] Inner cycle finished with code ${exitCode}: ${reason}`);

        if (exitCode === 0) return {finalStatus: "Job completed successfully."};
        if (exitCode === 1) return {finalStatus: `Job failed: ${reason}`};

        // For exitCode 2 (Standby), we just continue the loop
      } catch (error) {
        // This case handles unexpected crashes, e.g., service failures
        consecutiveErrors++;
        console.error(`[Master Loop] Caught exception during inner cycle:`, error);
        if (consecutiveErrors >= 3) {
          return {finalStatus: `Job failed: 3 consecutive unhandled exceptions. Last error: ${error instanceof Error ? error.message : String(error)}`};
        }
      }

      await delay(1500); // A small delay between cycles
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
