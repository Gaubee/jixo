import {createStep} from "@mastra/core/workflows";
import {match} from "ts-pattern";
import {usePlannerAgent} from "../agent/planner.js";
import {logManagerFactory} from "../services/logManagerFactory.js";
import {JixoJobWorkflowExitInfoSchema, JixoJobWorkflowInputSchema, TriagePlanSchema} from "./schemas.js";
export const planningStep = createStep({
  id: "planning",
  inputSchema: TriagePlanSchema,
  outputSchema: JixoJobWorkflowExitInfoSchema,
  async execute({inputData, mastra, getInitData}) {
    const init = getInitData<typeof JixoJobWorkflowInputSchema>();
    const {planningContext} = inputData;
    const {jobName, runnerId, jobGoal, workDir} = init;
    const logManager = await logManagerFactory.getOrCreate(jobName, {jobGoal, workDir});
    const currentLog = logManager.getLogFile();

    let planningPrompt = "";
    let objective = "";

    match(planningContext)
      .with({type: "fixFailure"}, (fixPlan) => {
        const failedTask = fixPlan.task;
        const failureLog = currentLog.workLog.find((w) => w.objective.includes(failedTask.id) && w.result === "Failed");
        planningPrompt = `### Failure Recovery Planning\nFailed Task: '${failedTask.id} ${failedTask.title}'\nError Summary: ${failureLog?.summary ?? "Unknown error"}`;
        objective = `Fix failed task ${failedTask.id}`;
      })
      .with({type: "rework"}, (reworkPlan) => {
        const reworkTask = reworkPlan.task;
        planningPrompt = `### Rework Planning\nOriginal Task: '${reworkTask.id} ${reworkTask.title}'\nReview Feedback: ${reworkTask.details}`;
        objective = `Rework task ${reworkTask.id} based on feedback`;
      })
      .with({type: "initial"}, () => {
        planningPrompt = `### Initial Planning\nGoal: "${init.jobGoal}". Create a plan.`;
        objective = "Create initial project plan";
      })
      .exhaustive();

    const result = await usePlannerAgent(mastra, planningPrompt, {logManager});
    console.log("QAQ plan result", result.object);

    const plans = result.object;
    let summary: string[] = [];
    for (const plan of plans) {
      await match(plan)
        .with({type: "add"}, async (item) => {
          const newTask = await logManager.addTask(item.task);
          summary.push(`Added Task:${newTask.id}.`);
        })
        .with({type: "update"}, async (item) => {
          await logManager.updateTask(item.id, item.changes);
          summary.push(`Updated Task:${item.id}.`);
        })
        .with({type: "cancel"}, async (item) => {
          await logManager.updateTask(item.id, {status: "Cancelled"});
          summary.push(`Cancelled Task:${item.id}.`);
        })
        .exhaustive();
    }

    // <!--[[这里为什么要清空details呢？]]-->
    if (planningContext.type === "rework") {
      await logManager.updateTask(planningContext.task.id, {details: ""});
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
