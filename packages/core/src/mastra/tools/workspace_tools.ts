import {createTool} from "@mastra/core";
import {z} from "zod";
import {workspaceManager} from "../services/workspaceManager.js";
import {assertJixoApp} from "../utils.js";
import type {JixoMasterWorkflow} from "../workflows/jixoMasterWorkflow.js";

export const workspaceToolsets = {
  create_job: createTool({
    id: "create_job",
    description: "Creates and starts a new JIXO job with a given name and goal.",
    inputSchema: z.object({
      jobName: z.string().describe("A unique, URL-friendly name for the job (e.g., 'snake-game-feature')."),
      jobGoal: z.string().describe("The high-level objective for the job."),
    }),
    outputSchema: z.object({
      runId: z.string(),
      status: z.string(),
    }),
    execute: async ({context, mastra}) => {
      const app = assertJixoApp(mastra);
      const jobManager = await workspaceManager.createJob(context.jobName, context.jobGoal);

      const workflow = app.getWorkflow("jixoMasterWorkflow") as JixoMasterWorkflow;
      const run = workflow.createRun();

      // Start job asynchronously
      run
        .start({
          inputData: jobManager.getJobInfo(),
        })
        .catch((err) => {
          app.getLogger().error("Failed to start job from tool", {err, runId: run.runId});
        });

      return {
        runId: run.runId,
        status: "started",
      };
    },
  }),
  list_jobs: createTool({
    id: "list_jobs",
    description: "Lists all existing jobs in the current workspace.",
    inputSchema: z.object({}),
    outputSchema: z.array(z.object({jobName: z.string(), jobGoal: z.string()})),
    execute: async () => {
      return workspaceManager.listJobs();
    },
  }),
  get_job_status: createTool({
    id: "get_job_status",
    description: "Gets the detailed status and log file content for a specific job.",
    inputSchema: z.object({
      jobName: z.string().describe("The name of the job to inspect."),
    }),
    // The output schema can be enhanced later to be more structured
    outputSchema: z.any(),
    execute: async ({context}) => {
      return workspaceManager.getJobLogFile(context.jobName);
    },
  }),
};
