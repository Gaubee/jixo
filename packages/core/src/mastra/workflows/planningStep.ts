import {createStep} from "@mastra/core/workflows";
import {match} from "ts-pattern";
import {usePlannerAgent} from "../agent/planner.js";
import {DELETE_FIELD_MARKER} from "../entities.js";
import {isJixoApp, ok} from "../utils.js";
import {JixoJobWorkflowExitInfoSchema, JixoJobWorkflowInputSchema, TriagePlanSchema} from "./schemas.js";

/**
 * The "Plan" phase of the P-E-R "AI Neuron".
 * This step is responsible for creating or modifying the job's roadmap.
 * It uses the PlannerAgent to analyze the job goal and current state,
 * and then generates a series of tasks with detailed instructions (`details`)
 * and acceptance criteria (`checklist`).
 */
export const planningStep = createStep({
  id: "planning",
  inputSchema: TriagePlanSchema,
  outputSchema: JixoJobWorkflowExitInfoSchema,
  async execute({inputData, mastra, getInitData}) {
    ok(isJixoApp(mastra));
    const workspaceManager = mastra.workspaceManager;

    const init = getInitData<typeof JixoJobWorkflowInputSchema>();
    const {planningContext} = inputData;
    const {jobName, runnerId, jobGoal, jobDir} = init;
    const logManager = await workspaceManager.getOrCreateJobManager(jobName, {jobName, jobGoal, jobDir});

    let planningPrompt = "";
    let objective = "";

    // Use ts-pattern to safely handle the different planning contexts
    match(planningContext)
      .with({type: "fixFailure"}, (fixPlan) => {
        const failedTask = fixPlan.task;
        planningPrompt = `### Failure Recovery Planning
**Error Type**: ${fixPlan.errorType ?? "unknown"}
**Failed Task**: '${failedTask.id} ${failedTask.title}'
**Error Summary**: ${fixPlan.errorSummary ?? "Unknown error"}

**Instruction**: Based on the error type, devise a recovery plan. 
- If 'transient', create a new task to retry the original one.
- If 'code_error', analyze the summary and create tasks to fix the code.`;
        objective = `Fix failed task ${failedTask.id}`;
      })
      .with({type: "rework"}, (reworkPlan) => {
        const reworkTask = reworkPlan.task;
        planningPrompt = `### Rework Planning\nOriginal Task: '${reworkTask.id} ${reworkTask.title}'\nReview Feedback: ${reworkTask.reworkReason}`;
        objective = `Rework task ${reworkTask.id} based on feedback`;
      })
      .with({type: "initial"}, () => {
        planningPrompt = `### Initial Planning\nGoal: "${init.jobGoal}". Create a plan.`;
        objective = "Create initial project plan";
      })
      .exhaustive();

    const plans = await usePlannerAgent(mastra, planningPrompt, {logManager});

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

    if (planningContext.type === "rework") {
      await logManager.updateTask(planningContext.task.id, {reworkReason: DELETE_FIELD_MARKER});
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
