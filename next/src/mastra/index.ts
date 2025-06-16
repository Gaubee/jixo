import {delay} from "@gaubee/util";
import {Mastra} from "@mastra/core";
import {Agent} from "@mastra/core/agent";
import {createStep, createWorkflow} from "@mastra/core/workflows";
import {LibSQLStore} from "@mastra/libsql";
import {PinoLogger} from "@mastra/loggers";
import path from "node:path";
import {z} from "zod";
import {LogFileSchema, RoadmapTaskNodeSchema, type LogFileData, type RoadmapTaskNodeData} from "./entities.js";
import {commonModel, thinkModel} from "./llm/index.js";
import {logManager, type NewTaskInput} from "./services/logManager.js";
import {tools} from "./tools/index.js";

// --- Agent Definitions ---
const plannerAgent = new Agent({
  name: "PlannerAgent",
  instructions: `You are an expert project planner. Your job is to create and modify a project roadmap.
- Tasks MUST have a 'title'.
- Use 'details' for complex implementation steps for the Executor.
- Use 'dependsOn' to specify task dependencies using their IDs.
- Use 'tags' to categorize tasks (e.g., 'backend', 'frontend', 'refactor').
- For rework, analyze the provided review feedback and create new sub-tasks to address the issues.
Your output is ONLY the raw Markdown for the task list.`,
  model: thinkModel,
});

const executorAgent = new Agent({
  name: "ExecutorAgent",
  instructions: `You are a diligent software engineer. You will receive a task with its full context (parent tasks).
- Your primary instruction is the 'details' field of your target task. If not present, use the 'title'.
- Execute the task using the provided tools.
- If 'gitCommit' is specified, use the git tool to commit your changes with a descriptive message.
Your output is a concise, one-sentence summary of the work you performed.`,
  model: commonModel,
  tools: {
    ...(await tools.fileSystem(path.join(process.cwd(), "demo"))),
    ...(await tools.pnpm()),
    // git tools will be added here later
  },
});

const reviewerAgent = new Agent({
  name: "ReviewerAgent",
  instructions: `You are a meticulous code reviewer and QA engineer. You will be given a completed task and a summary from the Executor.
- Your goal is to determine if the work meets the task's objective.
- If it meets the objective, respond with ONLY the word "Approved".
- If it does NOT meet the objective, provide a concise, actionable list of changes required for the Planner to create rework tasks. Example: "- The function is missing error handling for null inputs.\n- The UI component does not match the design spec."`,
  model: thinkModel,
});

// --- Utility Functions ---
const findTask = (predicate: (task: RoadmapTaskNodeData) => boolean, tasks: RoadmapTaskNodeData[]): RoadmapTaskNodeData | null => {
  for (const task of tasks) {
    if (predicate(task)) return task;
    if (task.children) {
      const found = findTask(predicate, task.children);
      if (found) return found;
    }
  }
  return null;
};
const isJobCompleted = (log: LogFileData) => (!log.roadmap.length ? false : log.roadmap.every((t) => t.status === "Completed"));

// --- Inner Loop Workflow (`jixoJobWorkflow`) ---

const JixoJobWorkflowInputSchema = z.object({
  jobName: z.string(),
  jobGoal: z.string(),
  runnerId: z.string(),
  otherRunners: z.array(z.string()),
});
const JixoJobWorkflowExitInfoSchema = z.object({
  exitCode: z.number(), // 0: Complete, 1: Error, 2: Standby/Continue
  reason: z.string(),
});

const TriageOutputSchema = z.object({
  action: z.enum(["plan", "execute", "review", "exit"]),
  log: LogFileSchema,
  task: RoadmapTaskNodeSchema.optional(),
  exitInfo: JixoJobWorkflowExitInfoSchema.optional(),
});
type TriageOutputData = z.infer<typeof TriageOutputSchema>;

const triageStep = createStep({
  id: "triage",
  inputSchema: JixoJobWorkflowInputSchema,
  outputSchema: TriageOutputSchema,
  async execute({inputData}): Promise<TriageOutputData> {
    const log = await logManager.getLogFile(inputData.jobName);
    if (!log.roadmap.length) {
      return {action: "plan", log, exitInfo: {exitCode: 2, reason: "Roadmap empty. Planning."}};
    }
    const taskToReview = findTask((t) => t.status === "PendingReview", log.roadmap);
    if (taskToReview) return {action: "review", log, task: taskToReview};

    // Simplified dependency check for demo: find a pending task with no pending dependencies.
    const pendingTask = findTask(
      (t) => t.status === "Pending" && (t.dependsOn ?? []).every((depId) => findTask((d) => d.id === depId, log.roadmap)?.status === "Completed"),
      log.roadmap,
    );
    if (pendingTask) return {action: "execute", log, task: pendingTask};

    if (isJobCompleted(log)) return {action: "exit", log, exitInfo: {exitCode: 0, reason: "All tasks completed."}};
    return {action: "exit", log, exitInfo: {exitCode: 2, reason: "No tasks ready to execute. Standby."}};
  },
});

const planningStep = createStep({
  id: "planning",
  inputSchema: TriageOutputSchema,
  outputSchema: JixoJobWorkflowExitInfoSchema,
  async execute({inputData, mastra, getInitData}) {
    const init = getInitData<typeof JixoJobWorkflowInputSchema>();
    // Here we would handle rework based on review feedback passed in inputData
    // For now, we only handle initial planning.
    const result = await mastra.getAgent("plannerAgent").generate(`Goal: "${init.jobGoal}". Create a plan.`);
    const newTasks: NewTaskInput[] = result.text
      .split("\n")
      .filter((l) => l.includes("- [ ]"))
      .map((l) => ({title: l.replace(/- \[\s*\]\s*/, "").trim()}));
    for (const task of newTasks) await logManager.addTask(init.jobName, "", task);
    await logManager.addWorkLog(init.jobName, {
      timestamp: new Date().toISOString(),
      runnerId: init.runnerId,
      role: "Planner",
      objective: "Create initial plan",
      result: "Succeeded",
      summary: `Created ${newTasks.length} tasks.`,
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
  },
});

const reviewStep = createStep({
  id: "review",
  inputSchema: TriageOutputSchema,
  outputSchema: JixoJobWorkflowExitInfoSchema,
  async execute({inputData, mastra, getInitData}) {
    const init = getInitData<typeof JixoJobWorkflowInputSchema>();
    const task = inputData.task!;
    const lastWorkLog = inputData.log.workLog[0]; // Assumes latest log is relevant

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
      // Revert task to pending and add the feedback to the task's details for the planner.
      const reworkDetails = `**Rework Required (Reviewer Feedback):**\n${result.text}`;
      await logManager.updateTask(init.jobName, task.id, {status: "Pending", details: reworkDetails});
      await logManager.addWorkLog(init.jobName, {
        timestamp: new Date().toISOString(),
        runnerId: init.runnerId,
        role: "Reviewer",
        objective: `Review task ${task.id}`,
        result: "Failed",
        summary: "Requires rework.",
      });
      return {exitCode: 2, reason: `Task ${task.id} requires rework.`};
    }
  },
});

const jixoJobWorkflow = createWorkflow({
  id: "jixoJobWorkflow",
  inputSchema: JixoJobWorkflowInputSchema,
  outputSchema: z.record(JixoJobWorkflowExitInfoSchema), // Adopting your discovery
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

// --- Outer Loop Workflow (`jixoMasterWorkflow`) ---

const JixoMasterWorkflowInputSchema = z.object({
  jobName: z.string(),
  jobGoal: z.string(),
  maxLoops: z.number().default(20),
});

const jixoMasterWorkflow = createWorkflow({
  id: "jixoMasterWorkflow",
  inputSchema: JixoMasterWorkflowInputSchema,
  outputSchema: z.object({finalStatus: z.string()}),
})
  .then(
    createStep({
      id: "masterLoop",
      inputSchema: JixoMasterWorkflowInputSchema,
      outputSchema: z.object({finalStatus: z.string()}),
      async execute({inputData, mastra}) {
        let loopCount = 0;
        await logManager.init(inputData.jobName);
        while (loopCount < inputData.maxLoops) {
          loopCount++;
          console.log(`\n--- JIXO Master Loop #${loopCount} ---`);
          const runnerId = `runner-${loopCount}`;
          const jobRun = (mastra.getWorkflow("jixoJobWorkflow") as typeof jixoJobWorkflow).createRun();
          const result = await jobRun.start({inputData: {jobName: inputData.jobName, jobGoal: inputData.jobGoal, runnerId, otherRunners: []}});

          if (result.status === "failed") return {finalStatus: `Job failed: ${result.error}`};
          if (result.status === "suspended") throw new Error("Workflow suspended unexpectedly.");

          const {exitCode, reason} = Object.values(result.result)[0];
          console.log(`[Master Loop] Inner cycle finished with code ${exitCode}: ${reason}`);

          if (exitCode === 0) return {finalStatus: "Job completed successfully."};
          if (exitCode === 1) return {finalStatus: `Job failed: ${reason}`};
          await delay(1500);
        }
        return {finalStatus: "Job stopped: Max loop count reached."};
      },
    }),
  )
  .commit();

// --- Mastra Instance Registration ---
export const mastra = new Mastra({
  agents: {
    plannerAgent,
    executorAgent,
    reviewerAgent,
  },
  workflows: {
    jixoJobWorkflow,
    jixoMasterWorkflow,
  },
  storage: new LibSQLStore({url: ":memory:"}),
  logger: new PinoLogger({name: "JIXO-on-Mastra", level: "info"}),
});
