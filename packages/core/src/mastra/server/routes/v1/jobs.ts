import {registerApiRoute} from "@mastra/core/server";
import {assertJixoApp} from "../../../utils.js";

export const jobsApi = registerApiRoute("/jixo/v1/jobs", {
  method: "POST",
  handler: async (c) => {
    const mastra = assertJixoApp(c.get("mastra"));
    const body = await c.req.json();
    const workflow = mastra.getWorkflow("jixoMasterWorkflow");

    const run = workflow.createRun();

    // Do not await this. Start the job asynchronously.
    run.start({inputData: body}).catch((err) => {
      mastra.getLogger().error("Master workflow execution failed", {err, runId: run.runId});
    });

    return c.json({runId: run.runId, status: "started", message: "JIXO Master Workflow started successfully."}, 202);
  },
});
