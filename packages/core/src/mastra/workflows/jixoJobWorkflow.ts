import {createStep, createWorkflow, type Step} from "@mastra/core/workflows";
import {z} from "zod";
import {executionStep} from "./executionStep.js";
import {planningStep} from "./planningStep.js";
import {reviewStep} from "./reviewStep.js";
import {JixoJobWorkflowExitInfoSchema, JixoJobWorkflowInputSchema, TriageExitSchema, TriageOutputSchema} from "./schemas.js";
import {triageStep} from "./triageStep.js";

/**
 * Represents the core "AI Neuron" of the JIXO system.
 *
 * This workflow embodies a single, complete cognitive-action cycle:
 * Plan -> Execute -> Review (P-E-R). It is designed to be a self-contained,
 * state-driven loop that makes incremental progress on a job.
 *
 * The cycle begins with the `triageStep`, which acts as the central decision-maker.
 * Based on the current state of the job (e.g., new, failed, pending review),
 * `triageStep` determines the next logical action and routes the workflow to the
 * appropriate step (`planningStep`, `executionStep`, or `reviewStep`).
 * After each action, the workflow loops back to `triageStep` to assess the new
 * state, continuing this cycle until the job is completed or a terminal failure occurs.
 */
export const jixoJobWorkflow = createWorkflow({
  id: "jixoJobWorkflow",
  inputSchema: JixoJobWorkflowInputSchema,
  outputSchema: z.record(z.string(), JixoJobWorkflowExitInfoSchema),
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
