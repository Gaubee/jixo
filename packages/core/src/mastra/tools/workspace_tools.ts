import {createTool} from "@mastra/core";
import {z} from "zod";
import type {JixoApp} from "../app.js";
import {assertJixoApp} from "../utils.js";
import type {JixoMasterWorkflow} from "../workflows/jixoMasterWorkflow.js";
import {JixoMasterWorkflowInputSchema} from "../workflows/schemas.js";

export const workspaceToolsets = {
  create_job: createTool({
    id: "create_job",
    description: "Creates and starts a new JIXO job with a given name and goal.",
    inputSchema: JixoMasterWorkflowInputSchema.pick({jobName: true, jobGoal: true}),
    outputSchema: z.object({
      runId: z.string().describe("The unique identifier for the started job run."),
      status: z.string().describe("The status of the job initiation, typically 'started'."),
    }),
    execute: async ({context, mastra}) => {
      const app = assertJixoApp(mastra);
      const workspaceManager = (app as JixoApp).workspaceManager;

      // Use the workspaceManager to create the job, which also creates the log file.
      const jobManager = await workspaceManager.createJob(context.jobName, context.jobGoal);
      const jobInfo = jobManager.getJobInfo();

      const workflow = app.getWorkflow("jixoMasterWorkflow") as JixoMasterWorkflow;
      const run = await workflow.createRunAsync();

      // Start job asynchronously. The master workflow will now run within the context of the job's jobDir.
      run
        .start({
          inputData: {
            ...jobInfo, // pass the full job info
            maxLoops: 20, // default or could be a tool parameter
            gitCommit: false, // default or could be a tool parameter
          },
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
    outputSchema: z.array(
      z.object({
        jobName: z.string().describe("The unique name of the job."),
        jobGoal: z.string().describe("The high-level goal of the job."),
      }),
    ),
    execute: async ({mastra}) => {
      const app = assertJixoApp(mastra);
      const workspaceManager = (app as JixoApp).workspaceManager;
      return workspaceManager.listJobs();
    },
  }),
  get_job_status: createTool({
    id: "get_job_status",
    description: "Gets the detailed status and log file content for a specific job.",
    inputSchema: z.object({
      jobName: z.string().describe("The name of the job to inspect."),
    }),
    outputSchema: z.any().describe("The full content of the job's log file, including roadmap and work log."),
    execute: async ({context, mastra}) => {
      const app = assertJixoApp(mastra);
      const workspaceManager = (app as JixoApp).workspaceManager;
      return workspaceManager.getJobLogFile(context.jobName);
    },
  }),
};
