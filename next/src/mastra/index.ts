import {delay} from "@gaubee/util";
import {Mastra} from "@mastra/core";
import {Agent} from "@mastra/core/agent";
import {createStep, createWorkflow} from "@mastra/core/workflows";
import {LibSQLStore} from "@mastra/libsql";
import {PinoLogger} from "@mastra/loggers";
import {z} from "zod";
import {LogFileSchema, type LogFileData, type RoadmapTaskData, type WorkLogEntryData} from "./entities.js";
import {commonModel, thinkModel} from "./llm/index.js";
import {logManager, parserAgent, serializerAgent} from "./services/logManager.js";

// --- Agent 定义 ---
const plannerAgent = new Agent({
  name: "PlannerAgent",
  instructions: `You are a master planner. Your role is to analyze the user's job and the current state, then create or update a 'Roadmap'. The roadmap should be a series of clear, atomic, and sequential tasks in Markdown checklist format. Return ONLY the Markdown content for the new roadmap.`,
  model: thinkModel,
});

const runnerAgent = new Agent({
  name: "RunnerAgent",
  instructions: `You are an executor. You will be given a specific task to complete. Perform the task and return a concise, one-sentence summary of the work you did.`,
  model: commonModel,
});

// --- 实体类定义 ---
class Task {
  constructor(
    public data: RoadmapTaskData,
    public readonly job: Job,
  ) {}
  get id() {
    return this.data.id;
  }
  get status() {
    return this.data.status;
  }
  get description() {
    return this.data.description;
  }
  async lock(runnerId: string) {
    this.data.status = "Locked";
    this.data.runner = runnerId;
    await this.job.save();
    console.log(`[Task] Task '${this.id}' locked by ${runnerId}.`);
  }
  async complete(summary: string, runnerId: string) {
    this.data.status = "Completed";
    this.job.addWorkLog({
      timestamp: new Date().toISOString(),
      runnerId: runnerId,
      role: "Runner",
      objective: `Task ${this.id}: ${this.description}`,
      result: "Succeeded",
      summary: summary,
    });
    await this.job.save();
    console.log(`[Task] Task '${this.id}' completed.`);
  }
  async unlock() {
    this.data.status = "Pending";
    this.data.runner = undefined;
    await this.job.save();
    console.log(`[Task] Stale lock on task '${this.id}' has been released.`);
  }
}

class Job {
  public log!: LogFileData;
  constructor(public readonly name: string) {}
  async load() {
    this.log = await logManager.read(this.name);
    return this;
  }
  async save() {
    await logManager.update(this.name, this.log);
  }
  get roadmap(): Task[] {
    return this.log.roadmap.map((taskData) => new Task(taskData, this));
  }
  get pendingTask(): Task | undefined {
    return this.roadmap.find((t) => t.status === "Pending");
  }
  get isCompleted(): boolean {
    if (this.roadmap.length === 0) return false;
    return this.roadmap.filter((t) => t.status !== "Cancelled").every((t) => t.status === "Completed");
  }
  addWorkLog(entry: WorkLogEntryData) {
    this.log.workLog.unshift(entry);
  }
}

// --- JIXO 工作流定义 ---
const JixoWorkflowInputSchema = z.object({
  jobName: z.string(),
  runnerId: z.string(),
  otherRunners: z.array(z.string()),
});

const TriageOutputSchema = z.object({
  role: z.enum(["Planner", "Runner", "Exit"]),
  reason: z.string(),
  job: z.instanceof(Job),
  payload: z.any().optional(),
});

const triageStep = createStep({
  id: "triage",
  description: "Analyzes the environment to decide the next action.",
  inputSchema: JixoWorkflowInputSchema,
  outputSchema: TriageOutputSchema,
  execute: async ({inputData}): Promise<z.infer<typeof TriageOutputSchema>> => {
    console.log(`[Triage] Runner ${inputData.runnerId} starting triage...`);
    const job = await new Job(inputData.jobName).load();

    // <!--[[MY_INFO]]--> 版本 9 核心改动：实现了完整的 PROTOCOL 0 分诊逻辑。

    // 1. 僵尸锁处理 (Stale Lock Reconciliation)
    const staleTasks = job.roadmap.filter((task) => task.status === "Locked" && task.data.runner && !inputData.otherRunners.includes(task.data.runner));
    if (staleTasks.length > 0) {
      // 在实际应用中，这里应该只有一个 runner 会成功执行解锁。
      // 为了演示，我们假设当前 runner 负责解锁。
      console.log(`[Triage] Found ${staleTasks.length} stale lock(s). Unlocking...`);
      for (const task of staleTasks) {
        await task.unlock();
      }
      // 解锁后，重新加载状态并重新分诊
      await job.load();
    }

    // 2. 检查失败任务
    const failedTask = job.roadmap.find((t) => t.status === "Failed");
    if (failedTask) return {role: "Planner", reason: `Found failed task: ${failedTask.id}. Re-planning is required.`, job, payload: {fixTaskId: failedTask.id}};

    // 3. 检查待办任务
    const pendingTask = job.pendingTask;
    if (pendingTask) return {role: "Runner", reason: `Found pending task: ${pendingTask.id}. Executing task.`, job, payload: {task: pendingTask}};

    // 4. 检查是否所有任务都已完成
    if (job.isCompleted) return {role: "Exit", reason: "All tasks completed successfully.", job, payload: {exitCode: 0}};

    // 5. 如果没有可执行的任务，但有其他 runner 在工作，则待命
    const lockedTaskByOthers = job.roadmap.find((t) => t.status === "Locked" && inputData.otherRunners.includes(t.data.runner || ""));
    if (lockedTaskByOthers) return {role: "Exit", reason: `No available tasks. Other runners are active.`, job, payload: {exitCode: 2}};

    // 6. 默认情况：需要规划
    return {role: "Planner", reason: "No pending tasks or active runners. Planning new tasks.", job};
  },
});

const planningStep = createStep({
  id: "planning",
  description: "Invokes the PlannerAgent to create or update the Roadmap.",
  inputSchema: TriageOutputSchema,
  outputSchema: z.object({status: z.string()}),
  execute: async ({inputData, mastra}) => {
    const {job, reason} = inputData;
    const planner = mastra.getAgent("plannerAgent");
    console.log(`[Planner] Reason: ${reason}. Invoking PlannerAgent...`);
    const jobGoal = "Refactor the project to improve modularity.";
    const result = await planner.generate(`The job goal is: "${jobGoal}". The current roadmap is empty. Please create a new plan.`);
    const newRoadmapMarkdown = result.text;
    const parser = mastra.getAgent("parserAgent");
    const parsedResult = await parser.generate(`---\ntitle: ""\nprogress: ""\n---\n## Roadmap\n${newRoadmapMarkdown}`, {output: LogFileSchema});
    job.log.roadmap = parsedResult.object.roadmap;
    job.log.title = jobGoal;
    job.log.progress = "10%";
    job.addWorkLog({
      timestamp: new Date().toISOString(),
      runnerId: inputData.job.name + "-runner-id",
      role: "Planner",
      objective: "Create initial project plan.",
      result: "Succeeded",
      summary: "Created initial roadmap based on job goal.",
    });
    await job.save();
    return {status: "Plan updated"};
  },
});

const executionStep = createStep({
  id: "execution",
  description: "Executes a single task.",
  inputSchema: TriageOutputSchema,
  outputSchema: z.object({status: z.string()}),
  execute: async ({inputData, mastra, getInitData}) => {
    const task = inputData.payload.task as Task;
    const runner = mastra.getAgent("runnerAgent");
    const initData = getInitData<typeof JixoWorkflowInputSchema>();
    const runnerId = initData.runnerId;
    console.log(`[Runner] Preparing to execute task ${task.id}...`);
    await task.lock(runnerId);
    console.log(`[Runner] Agent ${runnerId} is 'working' on task: "${task.description}"`);
    const result = await runner.generate(`Please complete the following task: "${task.description}". Provide a one-sentence summary of your work.`);
    const summary = result.text;
    await task.complete(summary, runnerId);
    return {status: `Task ${task.id} executed`};
  },
});

const exitStep = createStep({
  id: "exit",
  description: "Gracefully exits the workflow.",
  inputSchema: TriageOutputSchema,
  outputSchema: z.object({status: z.string(), reason: z.string()}),
  execute: async ({inputData}) => {
    const {job, reason, payload} = inputData;
    if (payload.exitCode === 0) {
      console.log(`[Exit] Updating progress to 100%`);
      job.log.progress = "100%";
      await job.save();
    }
    console.log(`[Exit] Workflow finished with code ${payload.exitCode}. Reason: ${reason}`);
    return {status: "Exited", reason: reason};
  },
});

const jixoJobWorkflow = createWorkflow({
  id: "jixoJobWorkflow",
  inputSchema: JixoWorkflowInputSchema,
  outputSchema: z.object({status: z.string(), reason: z.string()}),
})
  .then(triageStep)
  .branch([
    [async (result) => result.inputData.role === "Planner", planningStep],
    [async (result) => result.inputData.role === "Runner", executionStep],
    [async (result) => result.inputData.role === "Exit", exitStep],
  ])
  .commit();

// --- Mastra 实例注册 ---
export const mastra = new Mastra({
  agents: {plannerAgent, runnerAgent, parserAgent, serializerAgent},
  workflows: {jixoJobWorkflow},
  storage: new LibSQLStore({url: ":memory:"}),
  logger: new PinoLogger({name: "JIXO-on-Mastra", level: "info"}),
});

// --- 外层循环模拟器 ---
async function runJixoOuterLoop() {
  const jobName = "jixo-demo-job";
  await logManager.init(jobName, "---\ntitle: _待定_\nprogress: '0%'\n---\n\n## Roadmap\n\n## Work Log\n");

  const MAX_LOOP_TIMES = 10; // 增加循环次数以观察并发行为
  const CONCURRENT_RUNNERS = 2; // 定义并发运行器的数量
  let currentTimes = 1;

  // <!--[[MY_INFO]]--> 版本 9 改动:
  // - activeRunners 用于跟踪当前活跃的 runner ID。
  // - 循环现在通过 Promise.all 来并发启动多个工作流。
  let activeRunners = new Set<string>();

  while (currentTimes <= MAX_LOOP_TIMES) {
    console.log("\n" + "─".repeat(process.stdout.columns) + `\n JIXO Outer Loop - Run #${currentTimes}\n` + "─".repeat(process.stdout.columns));

    const runnerIds = Array.from({length: CONCURRENT_RUNNERS}, (_, i) => `${jobName}-runner-${currentTimes}-${i}`);
    activeRunners = new Set(runnerIds);

    const runPromises = runnerIds.map((runnerId) => {
      const run = mastra.getWorkflow("jixoJobWorkflow").createRun();
      const otherRunnersList = runnerIds.filter((id) => id !== runnerId);

      return run
        .start({
          inputData: {jobName, runnerId, otherRunners: otherRunnersList},
        })
        .then((result) => ({runnerId, result}));
    });

    const results = await Promise.all(runPromises);

    let shouldBreak = false;
    for (const {runnerId, result} of results) {
      console.log(`[Outer Loop] Runner ${runnerId} finished with status: ${result.status}`);
      if (result.status === "success") {
        const finalOutput = result.output as {status: string; reason: string};
        if (finalOutput?.status === "Exited" && finalOutput.reason.includes("All tasks completed")) {
          console.log("[Outer Loop] A runner reported job completion. Exiting loop.");
          shouldBreak = true;
        }
      }
    }

    if (shouldBreak) break;

    currentTimes++;
    await delay(2000);
  }
}

runJixoOuterLoop();
