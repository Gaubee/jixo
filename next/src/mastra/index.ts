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
  instructions: `You are a master planner. Your role is to analyze a job goal and create a 'Roadmap'. The roadmap should be a series of clear, atomic, and sequential tasks in Markdown checklist format. Each task should start with a Markdown checklist item '- [ ]'. You must only return the markdown for the tasks themselves. Example: '- [ ] Task 1\n- [ ] Task 2'`,
  model: thinkModel,
});

const runnerAgent = new Agent({
  name: "RunnerAgent",
  instructions: `You are an executor. You will be given a specific task to complete. Perform the task and return a concise, one-sentence summary of the work you did.`,
  model: commonModel,
  tools: {
    ...(await tools.fileSystem(path.join(process.cwd(), "demo"))),
    ...(await tools.pnpm()),
  },
});

// --- Utility Functions ---
function findNextPendingTask(tasks: RoadmapTaskNodeData[]): RoadmapTaskNodeData | null {
  for (const task of tasks) {
    if (task.status === "Pending") return task;
    if (task.children) {
      const pendingChild = findNextPendingTask(task.children);
      if (pendingChild) return pendingChild;
    }
  }
  return null;
}

function isJobCompleted(log: LogFileData): boolean {
  if (log.roadmap.length === 0) return false;
  const flattenTasks = (tasks: RoadmapTaskNodeData[]): RoadmapTaskNodeData[] => {
    return tasks.flatMap((t) => [t, ...(t.children ? flattenTasks(t.children) : [])]);
  };
  return flattenTasks(log.roadmap)
    .filter((t) => t.status !== "Cancelled")
    .every((t) => t.status === "Completed");
}

// --- Inner Loop Workflow (`jixoJobWorkflow`) ---

const JixoJobWorkflowInputSchema = z.object({
  jobName: z.string(),
  jobGoal: z.string(),
  runnerId: z.string(),
  otherRunners: z.array(z.string()),
});
const JixoJobWorkflowExitInfoSchema = z.object({
  exitCode: z.number(), // 0: Success, 1: Error, 2: Standby
  reason: z.string(),
});

const JixoJobWorkflowOutputSchema = z.object({
  action: z.enum(["plan", "run", "exit"]),
  log: LogFileSchema,
  taskToRun: RoadmapTaskNodeSchema.optional(),
  exitInfo: JixoJobWorkflowExitInfoSchema.optional(),
});
type JixoJobWorkflowOutputData = z.TypeOf<typeof JixoJobWorkflowOutputSchema>;

const triageStep = createStep({
  id: "triage",
  inputSchema: JixoJobWorkflowInputSchema,
  outputSchema: JixoJobWorkflowOutputSchema,
  async execute({inputData}) {
    console.log(`[Triage] Runner ${inputData.runnerId} starting triage...`);
    const log = await logManager.getLogFile(inputData.jobName);

    // Protocol 0: Health Check (Stale Locks) - Simplified for now

    // Protocol 0: Failed Task Triage - TODO

    // Protocol 0: Main Triage Logic
    if (log.roadmap.length === 0) {
      /**<!--[[你这里结构错了，我给你补全了，但是exitCode是不是0？我不确定你的意图]]--> */
      return {action: "plan", log, exitInfo: {exitCode: 0, reason: "Roadmap is empty. Planning initial tasks."}} satisfies JixoJobWorkflowOutputData;
    }

    const pendingTask = findNextPendingTask(log.roadmap);
    if (pendingTask) {
      return {action: "run", log, taskToRun: pendingTask} satisfies JixoJobWorkflowOutputData;
    }

    if (isJobCompleted(log)) {
      return {action: "exit", log, exitInfo: {exitCode: 0, reason: "All tasks completed successfully."}} satisfies JixoJobWorkflowOutputData;
    }

    // No pending tasks, but not complete -> Standby
    return {action: "exit", log, exitInfo: {exitCode: 2, reason: "No available tasks. Other runners may be active."}} satisfies JixoJobWorkflowOutputData;
  },
});

const planningStep = createStep({
  id: "planning",
  inputSchema: triageStep.outputSchema,
  outputSchema: JixoJobWorkflowExitInfoSchema,
  async execute({inputData, mastra, getInitData}) {
    const init = getInitData<typeof JixoJobWorkflowInputSchema>();
    const planner = mastra.getAgent("plannerAgent");

    console.log("[Planner] Invoking PlannerAgent to create initial plan...");
    const result = await planner.generate(`The job goal is: "${init.jobGoal}". Create a plan.`);
    const newTasksText = result.text.split("\n").filter((line) => line.trim().startsWith("- [ ]"));

    const newTasks: NewTaskInput[] = newTasksText.map((line) => ({
      description: line.replace(/- \[\s*\]\s*/, "").trim(),
    }));

    for (const task of newTasks) {
      await logManager.addTask(init.jobName, "", task);
    }

    await logManager.addWorkLog(init.jobName, {
      timestamp: new Date().toISOString(),
      runnerId: init.runnerId,
      role: "Planner",
      objective: "Create initial project plan.",
      result: "Succeeded",
      summary: `Created ${newTasks.length} initial tasks.`,
    });

    return {exitCode: 2, reason: "Planning complete, will re-triage in next loop."};
  },
});

const executionStep = createStep({
  id: "execution",
  inputSchema: triageStep.outputSchema,
  outputSchema: JixoJobWorkflowExitInfoSchema,
  async execute({inputData, mastra, getInitData}) {
    const init = getInitData<typeof JixoJobWorkflowInputSchema>();
    const runner = mastra.getAgent("runnerAgent");
    const task = inputData.taskToRun!;

    console.log(`[Runner] ${init.runnerId} starting task "${task.id}: ${task.description}"`);

    await logManager.updateTask(init.jobName, task.id, {status: "Locked", runner: init.runnerId});

    const result = await runner.generate(`Complete this task: "${task.description}". Provide a one-sentence summary.`);
    const summary = result.text;

    await logManager.updateTask(init.jobName, task.id, {status: "Completed"});

    await logManager.addWorkLog(init.jobName, {
      timestamp: new Date().toISOString(),
      runnerId: init.runnerId,
      role: "Runner",
      objective: `Execute task ${task.id}: ${task.description}`,
      result: "Succeeded",
      summary,
    });

    console.log(`[Runner] Task ${task.id} completed.`);
    return {exitCode: 2, reason: `Task ${task.id} executed.`};
  },
});

const jixoJobWorkflow = createWorkflow({
  id: "jixoJobWorkflow",
  inputSchema: JixoJobWorkflowInputSchema,
  // outputSchema:JixoJobWorkflowExitInfoSchema
  outputSchema: z.record(JixoJobWorkflowExitInfoSchema),
  //  z.union([
  //   z.object({[planningStep.id]: planningStep.outputSchema}),
  //   z.object({[executionStep.id]: executionStep.outputSchema}),
  //   z.object({exit: JixoJobWorkflowExitInfoSchema}),
  // ]),
})
  .then(triageStep)
  .branch([
    [async (res) => res.inputData.action === "plan", planningStep],
    [async (res) => res.inputData.action === "run", executionStep],
    [
      async (res) => res.inputData.action === "exit",
      createStep({
        id: "exit",
        inputSchema: triageStep.outputSchema,
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
  maxLoops: z.number().default(10),
});

const jixoMasterWorkflow = createWorkflow({
  id: "jixoMasterWorkflow",
  inputSchema: JixoMasterWorkflowInputSchema,
  outputSchema: z.object({finalStatus: z.string()}),
})
  /**<!--[[没有step这个函数，我印象是用then？请你检查mastra的文档]]--> */
  .then(
    createStep({
      id: "masterLoop",
      inputSchema: JixoMasterWorkflowInputSchema,
      outputSchema: z.object({finalStatus: z.string()}),
      async execute({inputData, mastra}) {
        let loopCount = 0;
        await logManager.init(inputData.jobName);
        const BREAK_LINE = "─".repeat(Math.max(process.stdout.columns, 10));

        while (loopCount < inputData.maxLoops) {
          loopCount++;
          console.log("\n" + BREAK_LINE + `\n JIXO Master Loop - Run #${loopCount}\n` + BREAK_LINE);

          const runnerId = `runner-${loopCount}`;
          const jobRun = (mastra.getWorkflow("jixoJobWorkflow") as typeof jixoJobWorkflow).createRun();
          const result = await jobRun.start({
            inputData: {
              jobName: inputData.jobName,
              jobGoal: inputData.jobGoal,
              runnerId: runnerId,
              otherRunners: [], // Concurrency simulation comes later
            },
          });
          if (result.status === "suspended") {
            /**<!--[[这里suspended状态应该如何处理呢？什么时候回触发suspended状态？]]-->> */
            throw new Error("workflow Suspended, should no happend");
          }

          if (result.status === "failed") {
            return {finalStatus: `Job failed with error: ${result.error}`};
          }
          // console.log("QAQ", result);
          /**
           * <!--[[
           * 经过日志调试，我发现这里的输出是基于branch的id来做key，我觉得这个设计非常吊诡。但只又相对合理。
           * mastra的api的类型安全并不够好，很多时候，官方文档也是模凌两可，所以以我的测试结果得出的正确代码为准。
           * ]]-->
           */
          const {exitCode, reason} = Object.values(result.result)[0];
          console.log(`[Master Loop] Inner workflow finished with code ${exitCode}: ${reason}`);

          if (exitCode === 0) {
            // Success
            return {finalStatus: "Job completed successfully."};
          }
          if (exitCode === 1) {
            // Error
            return {finalStatus: `Job failed with reason: ${reason}`};
          }
          // if exitCode is 2 (Standby), loop continues...
          await delay(2000);
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
    runnerAgent,
  },
  workflows: {
    jixoJobWorkflow,
    jixoMasterWorkflow,
  },
  storage: new LibSQLStore({url: ":memory:"}),
  logger: new PinoLogger({name: "JIXO-on-Mastra", level: "info"}),
});
