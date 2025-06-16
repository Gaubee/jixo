import {createStep, createWorkflow} from "@mastra/core/workflows";
import {z} from "zod";
import {executionStep} from "./executionStep.js";
import {planningStep} from "./planningStep.js";
import {reviewStep} from "./reviewStep.js";
import {JixoJobWorkflowExitInfoSchema, JixoJobWorkflowInputSchema, TriageOutputSchema} from "./schemas.js";
import {triageStep} from "./triageStep.js";

export const jixoJobWorkflow = createWorkflow({
  id: "jixoJobWorkflow",
  inputSchema: JixoJobWorkflowInputSchema,
  outputSchema: z.record(JixoJobWorkflowExitInfoSchema),
})
  .then(triageStep)
  .branch([
    [async (res) => res.inputData.action === "plan", planningStep],
    [async (res) => res.inputData.action === "execute", executionStep],
    [async (res) => res.inputData.action === "review", reviewStep],
    [
      async (res) => res.inputData.action === "exit",
      createStep({
        id: "exit",
        inputSchema: TriageOutputSchema,
        outputSchema: JixoJobWorkflowExitInfoSchema,
        execute: async ({inputData}) => inputData.exitInfo!,
      }),
    ],
  ])
  .commit();
