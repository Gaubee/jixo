import {RuntimeContext} from "@mastra/core/runtime-context";
import {createStep} from "@mastra/core/workflows";
import {PlannerOutputSchema} from "../agent/schemas.js";
import {logManagerFactory} from "../services/logManagerFactory.js";
import {JixoJobWorkflowExitInfoSchema, JixoJobWorkflowInputSchema, TriagePlanSchema} from "./schemas.js";

export const planningStep = createStep({
  id: "planning",
  inputSchema: TriagePlanSchema,
  outputSchema: JixoJobWorkflowExitInfoSchema,
  async execute({inputData, mastra, getInitData}) {
    const init = getInitData<typeof JixoJobWorkflowInputSchema>();
    const {planningContext, log} = inputData;
    const {jobName, runnerId} = init;
    const logManager = await logManagerFactory.getOrCreate(jobName);

    let prompt: string;
    let objective = "";

    switch (planningContext?.type) {
      case "fixFailure":
        const failedTask = planningContext.task!;
        const failureLog = log.workLog.find((w) => w.objective.includes(failedTask.id) && w.result === "Failed");
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

    const runtimeContext = new RuntimeContext();
    runtimeContext.set("jobGoal", init.jobGoal);
    runtimeContext.set("roadmap", log.roadmap);
    runtimeContext.set("workDir", log.env?.workDir ?? init.workDir);

    const result = await mastra.getAgent("plannerAgent").generate(prompt, {
      output: PlannerOutputSchema,
      runtimeContext,
    });

    const plan = result.object;
    let summary = [];

    if (plan.cancel && plan.cancel.length > 0) {
      for (const taskId of plan.cancel) {
        await logManager.updateTask(taskId, {status: "Cancelled"});
      }
      summary.push(`Cancelled ${plan.cancel.length} task(s).`);
    }

    if (plan.update && plan.update.length > 0) {
      for (const item of plan.update) {
        await logManager.updateTask(item.id, item.changes);
      }
      summary.push(`Updated ${plan.update.length} task(s).`);
    }

    if (plan.add && plan.add.length > 0) {
      for (const task of plan.add) {
        await logManager.addTask(task);
      }
      summary.push(`Added ${plan.add.length} new root task(s).`);
    }

    if (planningContext?.type === "rework") {
      await logManager.updateTask(planningContext.task!.id, {details: ""});
    }

    await logManager.addWorkLog({
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
