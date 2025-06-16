import {createStep, createWorkflow} from "@mastra/core/workflows";
import {z} from "zod";
import {LogFileSchema, RoadmapTaskNodeSchema} from "../entities.js";
import {isJobCompleted} from "../services/logHelper.js";
import {logManager, type NewTaskInput} from "../services/logManager.js";
import {REWORK_MARKER} from "./utils.js";

// --- Schema Definitions for the Inner Loop ---

const JixoJobWorkflowInputSchema = z.object({
  jobName: z.string(),
  jobGoal: z.string(),
  runnerId: z.string(),
  otherRunners: z.array(z.string()),
});

export const JixoJobWorkflowExitInfoSchema = z.object({
  exitCode: z.number(), // 0: Complete, 1: Error, 2: Standby/Continue
  reason: z.string(),
});

const PlanningContextSchema = z.object({
  type: z.enum(["initial", "rework", "fixFailure"]),
  task: RoadmapTaskNodeSchema.optional(), // The task needing rework or fixing
});

const TriageOutputSchema = z.object({
  action: z.enum(["plan", "execute", "review", "exit"]),
  log: LogFileSchema,
  task: RoadmapTaskNodeSchema.optional(),
  planningContext: PlanningContextSchema.optional(),
  exitInfo: JixoJobWorkflowExitInfoSchema.optional(),
});
type TriageOutputData = z.infer<typeof TriageOutputSchema>;

// --- Step Definitions ---

const triageStep = createStep({
  id: "triage",
  inputSchema: JixoJobWorkflowInputSchema,
  outputSchema: TriageOutputSchema,
  async execute({inputData}): Promise<TriageOutputData> {
    const log = await logManager.getLogFile(inputData.jobName);

    if (!log.roadmap.length) {
      return {action: "plan", log, planningContext: {type: "initial"}};
    }

    const failedTask = await logManager.findTask((t) => t.status === "Failed", inputData.jobName);
    if (failedTask) {
      return {action: "plan", log, planningContext: {type: "fixFailure", task: failedTask}};
    }

    const taskToReview = await logManager.findTask((t) => t.status === "PendingReview", inputData.jobName);
    if (taskToReview) {
      return {action: "review", log, task: taskToReview};
    }

    const taskForRework = await logManager.findTask((t) => t.status === "Pending" && t.details?.startsWith(REWORK_MARKER), inputData.jobName);
    if (taskForRework) {
      return {action: "plan", log, planningContext: {type: "rework", task: taskForRework}};
    }

    const {type, task: actionableTask} = await logManager.getNextActionableTask(inputData.jobName);
    if (type === "execute") {
      return {action: "execute", log, task: actionableTask!};
    }

    if (isJobCompleted(log)) {
      return {action: "exit", log, exitInfo: {exitCode: 0, reason: "All tasks completed."}};
    }
    return {action: "exit", log, exitInfo: {exitCode: 2, reason: "No tasks ready to execute. Standby."}};
  },
});

const planningStep = createStep({
  id: "planning",
  inputSchema: TriageOutputSchema,
  outputSchema: JixoJobWorkflowExitInfoSchema,
  async execute({inputData, mastra, getInitData}) {
    const init = getInitData<typeof JixoJobWorkflowInputSchema>();
    const {planningContext} = inputData;

    let prompt: string;
    let parentTaskId = "";
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
        parentTaskId = reworkTask.id; // Rework tasks are sub-tasks
        objective = `Rework task ${reworkTask.id} based on feedback`;
        break;
      default: // 'initial'
        prompt = `### Initial Planning\nGoal: "${init.jobGoal}". Create a plan.`;
        objective = "Create initial project plan";
        break;
    }

    const result = await mastra.getAgent("plannerAgent").generate(prompt);
    const newTasks: NewTaskInput[] = result.text
      .split("\n")
      .filter((l) => l.includes("- [ ]"))
      .map((l) => ({title: l.replace(/- \[\s*\]\s*/, "").trim()}));

    for (const task of newTasks) {
      await logManager.addTask(init.jobName, parentTaskId, task);
    }

    if (planningContext?.type === "rework") {
      await logManager.updateTask(init.jobName, planningContext.task!.id, {details: ""});
    }

    await logManager.addWorkLog(init.jobName, {
      timestamp: new Date().toISOString(),
      runnerId: init.runnerId,
      role: "Planner",
      objective,
      result: "Succeeded",
      summary: `Created ${newTasks.length} new tasks.`,
    });
    return {exitCode: 2, reason: "Planning complete."};
  },
});

const executionStep = createStep({
  id: "execution",
  inputSchema: TriageOutputSchema,
  outputSchema: JixoJobWorkflowExitInfoSchema,
  async execute({inputData, mastra, getInitData}) {
    const init = getInitData<typeof JixoJobWorkflowInputSchema>();
    const task = inputData.task!;

    try {
      await logManager.updateTask(init.jobName, task.id, {status: "Locked", executor: init.runnerId});
      const result = await mastra.getAgent("executorAgent").generate(`Task: ${task.title}. Details: ${task.details ?? "N/A"}`);
      if (task.gitCommit) {
        console.log(`[Executor] Simulating: git commit -m "feat(task-${task.id}): ${result.text}"`);
      }
      await logManager.updateTask(init.jobName, task.id, {status: "PendingReview"});
      await logManager.addWorkLog(init.jobName, {
        timestamp: new Date().toISOString(),
        runnerId: init.runnerId,
        role: "Executor",
        objective: `Execute task ${task.id}`,
        result: "Succeeded",
        summary: result.text,
      });
      return {exitCode: 2, reason: `Task ${task.id} executed, now pending review.`};
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[Executor] Task ${task.id} failed:`, errorMessage);
      await logManager.updateTask(init.jobName, task.id, {status: "Failed"});
      await logManager.addWorkLog(init.jobName, {
        timestamp: new Date().toISOString(),
        runnerId: init.runnerId,
        role: "Executor",
        objective: `Execute task ${task.id}`,
        result: "Failed",
        summary: errorMessage,
      });
      return {exitCode: 2, reason: `Task ${task.id} failed and was logged.`};
    }
  },
});

const reviewStep = createStep({
  id: "review",
  inputSchema: TriageOutputSchema,
  outputSchema: JixoJobWorkflowExitInfoSchema,
  async execute({inputData, mastra, getInitData}) {
    const init = getInitData<typeof JixoJobWorkflowInputSchema>();
    const task = inputData.task!;
    const lastWorkLog = inputData.log.workLog[0];

    const result = await mastra.getAgent("reviewerAgent").generate(`Task Title: ${task.title}\nExecutor's Summary: ${lastWorkLog.summary}\n\nDoes this meet the objective?`);

    if (result.text.trim().toLowerCase() === "approved") {
      await logManager.updateTask(init.jobName, task.id, {status: "Completed", reviewer: init.runnerId});
      await logManager.addWorkLog(init.jobName, {
        timestamp: new Date().toISOString(),
        runnerId: init.runnerId,
        role: "Reviewer",
        objective: `Review task ${task.id}`,
        result: "Succeeded",
        summary: "Approved.",
      });
      return {exitCode: 2, reason: `Task ${task.id} approved.`};
    } else {
      const reworkDetails = `${REWORK_MARKER}:\n${result.text}`;
      await logManager.updateTask(init.jobName, task.id, {status: "Pending", details: reworkDetails});
      await logManager.addWorkLog(init.jobName, {
        timestamp: new Date().toISOString(),
        runnerId: init.runnerId,
        role: "Reviewer",
        objective: `Review task ${task.id}`,
        result: "Failed",
        summary: `Requires rework. Feedback: ${result.text}`,
      });
      return {exitCode: 2, reason: `Task ${task.id} requires rework.`};
    }
  },
});

// --- Workflow Definition ---

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
