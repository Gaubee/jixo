import {createTool} from "@mastra/core";
import type {ToolsInput} from "@mastra/core/agent";
import z from "zod";
import type {JixoMasterWorkflow} from "../workflows/jixoMasterWorkflow.js";
import {JixoMasterWorkflowInputSchema, JixoMasterWorkflowOutputSchema} from "../workflows/schemas.js";

export const jobToolsets = {
  run_job: createTool({
    id: "run_job",
    description: "Run a complex job. for example: create a new project",
    inputSchema: JixoMasterWorkflowInputSchema,
    outputSchema: JixoMasterWorkflowOutputSchema,
    execute: async ({context: _context, mastra}) => {
      const context = _context as z.TypeOf<typeof JixoMasterWorkflowInputSchema>;
      //   ok(isJixoApp(mastra));
      const masterRun = await (mastra.getWorkflow("jixoMasterWorkflow") as JixoMasterWorkflow).createRunAsync();
      const result = await masterRun.start({
        inputData: context,
      });

      if (result.status === "success") {
        return result.result;
      } else if (result.status === "failed") {
        throw result.error;
      } else if (result.status === "suspended") {
        throw result.suspended;
      }
      return result;
    },
  }),
} satisfies ToolsInput;
