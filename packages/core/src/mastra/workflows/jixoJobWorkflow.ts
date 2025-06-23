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
    [async (res) => "plan" === res.inputData.action, planningStep as any as Step<"planning", typeof TriageOutputSchema, typeof JixoJobWorkflowExitInfoSchema>],
    [async (res) => "execute" === res.inputData.action, executionStep as any as Step<"execution", typeof TriageOutputSchema, typeof JixoJobWorkflowExitInfoSchema>],
    [async (res) => "review" === res.inputData.action, reviewStep as any as Step<"review", typeof TriageOutputSchema, typeof JixoJobWorkflowExitInfoSchema>],
    [
      async (res) => "exit" === res.inputData.action,
      createStep({
        id: "exit",
        inputSchema: TriageExitSchema,
        outputSchema: JixoJobWorkflowExitInfoSchema,
        execute: async ({inputData}) => inputData.exitInfo!,
      }) as any as Step<"exit", typeof TriageOutputSchema, typeof JixoJobWorkflowExitInfoSchema>,
    ],
  ])
  .commit();

export type JixoJobWorkflow = typeof jixoJobWorkflow;
