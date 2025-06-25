import {registerApiRoute} from "@mastra/core/server";
import {workspaceManager} from "../../../services/workspaceManager.js";
import {assertJixoApp} from "../../../utils.js";
import {JixoMasterWorkflowInputSchema} from "../../../workflows/schemas.js";

export const jobsApi = [
  registerApiRoute("/jixo/v1/jobs", {
    method: "POST",
    handler: async (c) => {
      const mastra = assertJixoApp(c.get("mastra"));
      const body = await c.req.json();
      const jobData = JixoMasterWorkflowInputSchema.parse(body);

      // Create job via workspace manager
      await workspaceManager.createJob(jobData.jobName, jobData.jobGoal);

      const workflow = mastra.getWorkflow("jixoMasterWorkflow");
      const run = workflow.createRun();

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
      const jobs = await workspaceManager.listJobs();
      return c.json(jobs);
    },
  }),
  registerApiRoute("/jixo/v1/jobs/:jobName", {
    method: "GET",
    handler: async (c) => {
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
