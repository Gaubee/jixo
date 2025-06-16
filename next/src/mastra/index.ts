import {delay} from "@gaubee/util";
import {Mastra} from "@mastra/core";
import {createStep, createWorkflow} from "@mastra/core/workflows";
import {LibSQLStore} from "@mastra/libsql";
import {PinoLogger} from "@mastra/loggers";
import path from "node:path";
import {z} from "zod";
import {createExecutorAgent, plannerAgent, reviewerAgent} from "./agent/index.js";
import {LogFileSchema, RoadmapTaskNodeSchema, type LogFileData} from "./entities.js";
import {logManager, type NewTaskInput} from "./services/logManager.js";
// --- Utility Functions ---
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

    // If roadmap is empty, we must plan first.
    if (!log.roadmap.length) {
      return {action: "plan", log};
    }

    // Delegate task selection to the LogManager
    const {type, task} = await logManager.getNextActionableTask(inputData.jobName);

    if (type === "review") {
      return {action: "review", log, task: task!};
    }

    if (type === "execute") {
      return {action: "execute", log, task: task!};
    }

    // If no actionable tasks, check for job completion or go to standby.
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

const workDir = path.join(process.cwd(), "./");

export const mastra = new Mastra({
  agents: {plannerAgent, executorAgent: await createExecutorAgent(workDir), reviewerAgent},
  workflows: {jixoJobWorkflow, jixoMasterWorkflow},
  storage: new LibSQLStore({url: ":memory:"}),
  logger: new PinoLogger({name: "JIXO", level: "info"}),
});
