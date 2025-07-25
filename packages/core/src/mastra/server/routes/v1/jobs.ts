import {registerApiRoute} from "@mastra/core/server";
import {type JixoApp} from "../../../app.js";
import {assertJixoApp} from "../../../utils.js";
import {JixoMasterWorkflowInputSchema} from "../../../workflows/schemas.js";
import type {ApiRoute} from "../types.js";

export const jobsApi: ApiRoute[] = [
  registerApiRoute("/jixo/v1/jobs", {
    method: "POST",
    handler: async (c) => {
      const mastra = assertJixoApp(c.get("mastra"));
      const workspaceManager = (mastra as JixoApp).workspaceManager;

      const body = await c.req.json();
      const jobData = JixoMasterWorkflowInputSchema.parse(body);

      // Create job via workspace manager
      await workspaceManager.createJob(jobData.jobName, jobData.jobGoal);

      const workflow = mastra.getWorkflow("jixoMasterWorkflow");
      const run = await workflow.createRunAsync();

      // Asynchronously start the job
      run.start({inputData: jobData}).catch((err) => {
        mastra.getLogger().error("Master workflow execution failed", {err, runId: run.runId});
      });

      return c.json({runId: run.runId, status: "started", message: `Job '${jobData.jobName}' started successfully.`}, 202);
    },
  }),
  registerApiRoute("/jixo/v1/jobs", {
    method: "GET",
    handler: async (c) => {
      const mastra = assertJixoApp(c.get("mastra"));
      const workspaceManager = (mastra as JixoApp).workspaceManager;
      const jobs = await workspaceManager.listJobs();
      return c.json(jobs);
    },
  }),
  registerApiRoute("/jixo/v1/jobs/:jobName", {
    method: "GET",
    handler: async (c) => {
      const mastra = assertJixoApp(c.get("mastra"));
      const workspaceManager = (mastra as JixoApp).workspaceManager;
      const jobName = c.req.param("jobName");
      try {
        const logFile = await workspaceManager.getJobLogFile(jobName);
        return c.json(logFile);
      } catch (error) {
        if (error instanceof Error && error.message.includes("not found")) {
          return c.json({error: error.message}, 404);
        }
        return c.json({error: "Failed to retrieve job log"}, 500);
      }
    },
  }),
];
