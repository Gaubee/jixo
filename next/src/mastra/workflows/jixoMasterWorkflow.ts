import {delay} from "@gaubee/util";
import {createStep, createWorkflow} from "@mastra/core/workflows";
import {z} from "zod";
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
    await logManager.init(inputData.jobName);
    while (loopCount < inputData.maxLoops) {
      loopCount++;
      console.log(`\n--- JIXO Master Loop #${loopCount} ---`);
      const runnerId = `runner-${loopCount}`;
      const jobRun = (mastra.getWorkflow("jixoJobWorkflow") as typeof jixoJobWorkflow).createRun();
      const result = await jobRun.start({inputData: {jobName: inputData.jobName, jobGoal: inputData.jobGoal, runnerId, otherRunners: []}});

      if (result.status === "failed") return {finalStatus: `Job failed: ${result.error}`};
      if (result.status === "suspended") throw new Error("Workflow suspended unexpectedly.");

      const {exitCode, reason} = Object.values(result.result)[0];
      console.log(`[Master Loop] Inner cycle finished with code ${exitCode}: ${reason}`);

      if (exitCode === 0) return {finalStatus: "Job completed successfully."};
      if (exitCode === 1) return {finalStatus: `Job failed: ${reason}`};
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
