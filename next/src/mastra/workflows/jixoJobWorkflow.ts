import {createStep, createWorkflow, type Step} from "@mastra/core/workflows";
import {z} from "zod";
import {executionStep} from "./executionStep.js";
import {planningStep} from "./planningStep.js";
import {reviewStep} from "./reviewStep.js";
import {JixoJobWorkflowExitInfoSchema, JixoJobWorkflowInputSchema, TriageExitSchema, TriageOutputSchema} from "./schemas.js";
import {triageStep} from "./triageStep.js";

export const jixoJobWorkflow = createWorkflow({
  id: "jixoJobWorkflow",
  inputSchema: JixoJobWorkflowInputSchema,
  outputSchema: z.record(JixoJobWorkflowExitInfoSchema),
})
  .then(triageStep)
  .branch([
    [async (res) => res.inputData.action === "plan", planningStep as any as Step<"planning", typeof TriageOutputSchema, typeof JixoJobWorkflowExitInfoSchema>],
    [async (res) => res.inputData.action === "execute", executionStep as any as Step<"execution", typeof TriageOutputSchema, typeof JixoJobWorkflowExitInfoSchema>],
    [async (res) => res.inputData.action === "review", reviewStep as any as Step<"review", typeof TriageOutputSchema, typeof JixoJobWorkflowExitInfoSchema>],
    [
      async (res) => res.inputData.action === "exit",
      createStep({
        id: "exit",
        inputSchema: TriageExitSchema,
        outputSchema: JixoJobWorkflowExitInfoSchema,
        execute: async ({inputData}) => inputData.exitInfo!,
      }) as any as Step<"exit", typeof TriageOutputSchema, typeof JixoJobWorkflowExitInfoSchema>,
    ],
  ])
  .commit();
