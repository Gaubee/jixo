import {createStep, createWorkflow} from "@mastra/core/workflows";
import {z} from "zod";
import {PlannerOutputSchema} from "../agent/schemas.js";
import {isJobCompleted} from "../services/logHelper.js";
import {logManager} from "../services/logManager.js";
import {JixoJobWorkflowExitInfoSchema, JixoJobWorkflowInputSchema, TriageOutputSchema, type TriageOutputData} from "./schemas.js";
import {REWORK_MARKER} from "./utils.js";
import {triageStep} from './triageStep.js'

export const planningStep = createStep({
  id: "planning",
  inputSchema: TriageOutputSchema,
  outputSchema: JixoJobWorkflowExitInfoSchema,
  async execute({inputData, mastra, getInitData}) {
    const init = getInitData<typeof JixoJobWorkflowInputSchema>();
    const {planningContext} = inputData;
    const {jobName, runnerId} = init;

    let prompt: string;
    let objective = "";

    switch (planningContext?.type) {
      case "fixFailure":
        const failedTask = planningContext.task!;
        const failureLog = inputData.log.workLog.find((w) => w.objective.includes(failedTask.id) && w.result === "Failed");
        prompt = `### Failure Recovery Planning\nFailed Task: '${failedTask.id} ${failedTask.title}'\nError Summary: ${failureLog?.summary ?? "Unknown error"}`;
        objective = `Fix failed task ${failedTask.id}`;
        break;
      case "rework":
        const reworkTask = planningContext.task!;
        prompt = `### Rework Planning\nOriginal Task: '${reworkTask.id} ${reworkTask.title}'\nReview Feedback: ${reworkTask.details}`;
        objective = `Rework task ${reworkTask.id} based on feedback`;
        break;
      default: // 'initial'
        prompt = `### Initial Planning\nGoal: "${init.jobGoal}". Create a plan.`;
        objective = "Create initial project plan";
        break;
    }

    const result = await mastra.getAgent("plannerAgent").generate(prompt, {
      output: PlannerOutputSchema,
    });

    const plan = result.object;
    let summary = [];

    if (plan.cancel && plan.cancel.length > 0) {
      for (const taskId of plan.cancel) {
        await logManager.updateTask(jobName, taskId, {status: "Cancelled"});
      }
      summary.push(`Cancelled ${plan.cancel.length} task(s).`);
    }

    if (plan.update && plan.update.length > 0) {
      for (const item of plan.update) {
        // Here we assume updates don't add sub-tasks for simplicity, though the schema allows it.
        // A more complex implementation would handle adding children via update.
        await logManager.updateTask(jobName, item.id, item.changes);
      }
      summary.push(`Updated ${plan.update.length} task(s).`);
    }

    if (plan.add && plan.add.length > 0) {
      for (const task of plan.add) {
        // addTask now correctly handles adding new root tasks with their children.
        await logManager.addTask(jobName, task);
      }
      summary.push(`Added ${plan.add.length} new root task(s).`);
    }

    if (planningContext?.type === "rework") {
      await logManager.updateTask(jobName, planningContext.task!.id, {details: ""});
    }

    await logManager.addWorkLog(jobName, {
      timestamp: new Date().toISOString(),
      runnerId: runnerId,
      role: "Planner",
      objective,
      result: "Succeeded",
      summary: summary.length > 0 ? summary.join(" ") : "No changes to the plan were made.",
    });

    return {exitCode: 2, reason: "Planning complete."};
  },
});