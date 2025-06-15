import {delay} from "@gaubee/util";
import {Mastra} from "@mastra/core";
import {Agent} from "@mastra/core/agent";
import {createStep, createWorkflow} from "@mastra/core/workflows";
import {LibSQLStore} from "@mastra/libsql";
import {PinoLogger} from "@mastra/loggers";
import path from "node:path";
import {uuidv7} from "uuidv7";
import {z} from "zod";
import {LogFileSchema, type RoadmapTaskData, type WorkLogEntryData} from "./entities.js";
import {commonModel, thinkModel} from "./llm/index.js";
import {logManager, parserAgent, serializerAgent} from "./services/logManager.js";
import {tools} from "./tools/index.js";

const process_id = uuidv7();
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
  public log!: z.infer<typeof LogFileSchema>;
  constructor(
    public readonly name: string,
    public readonly goal: string,
  ) {} // Job 现在有了一个明确的目标
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
  jobGoal: z.string(), // 作业目标现在是工作流的输入
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
    const job = await new Job(inputData.jobName, inputData.jobGoal).load();
    const staleTasks = job.roadmap.filter((task) => task.status === "Locked" && task.data.runner && !inputData.otherRunners.includes(task.data.runner));
    if (staleTasks.length > 0) {
      console.log(`[Triage] Found ${staleTasks.length} stale lock(s). Unlocking...`);
      for (const task of staleTasks) await task.unlock();
      await job.load();
    }
    const failedTask = job.roadmap.find((t) => t.status === "Failed");
    if (failedTask) return {role: "Planner", reason: `Found failed task: ${failedTask.id}. Re-planning is required.`, job, payload: {fixTaskId: failedTask.id}};
    const pendingTask = job.pendingTask;
    if (pendingTask) return {role: "Runner", reason: `Found pending task: ${pendingTask.id}.`, job, payload: {task: pendingTask}};
    if (job.isCompleted) return {role: "Exit", reason: "All tasks completed successfully.", job, payload: {exitCode: 0}};
    const lockedTaskByOthers = job.roadmap.find((t) => t.status === "Locked" && inputData.otherRunners.includes(t.data.runner || ""));
    if (lockedTaskByOthers) return {role: "Exit", reason: `No available tasks. Other runners are active.`, job, payload: {exitCode: 2}};
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
    const parser = mastra.getAgent("parserAgent");

    console.log(`[Planner] Reason: ${reason}. Invoking PlannerAgent...`);

    // <!--[[MY_INFO]]--> 版本 10 核心改动：真实调用 PlannerAgent 生成计划
    const result = await planner.generate(`The job goal is: "${job.goal}". The current roadmap is empty. Please create a new plan.`);
    const newRoadmapMarkdown = result.text;

    // 使用 ParserAgent 将 Planner 生成的 Markdown 解析为结构化数据
    const parsedResult = await parser.generate(
      // 我们需要构造一个最小化的、可被解析的 Markdown 字符串
      `---\ntitle: ""\nprogress: ""\n---\n## Roadmap\n${newRoadmapMarkdown}`,
      {output: LogFileSchema},
    );

    job.log.roadmap = parsedResult.object.roadmap;
    job.log.title = job.goal;
    job.log.progress = "10%";
    job.addWorkLog({
      timestamp: new Date().toISOString(),
      runnerId: `${job.name}-planner-${process_id}`,
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
  outputSchema: z.object({
    status: z.string(),
    reason: z.string(),
  }),
})
  .then(triageStep)
  .branch([
    [async (result) => result.inputData.role === "Planner", planningStep],
    [async (result) => result.inputData.role === "Runner", executionStep],
    [async (result) => result.inputData.role === "Exit", exitStep],
  ])
  .commit();

// --- Agent 定义 ---
const plannerAgent = new Agent({
  name: "PlannerAgent",
  instructions: `You are a master planner. Your role is to analyze the user's job and the current state, then create or update a 'Roadmap'. The roadmap should be a series of clear, atomic, and sequential tasks in Markdown checklist format. Return ONLY the Markdown content for the new roadmap, starting with the first task item (e.g., '- [ ] ...').`,
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

// --- Mastra 实例注册 ---

export const mastra = new Mastra({
  agents: {plannerAgent, runnerAgent, parserAgent, serializerAgent},
  workflows: {jixoJobWorkflow},
  storage: new LibSQLStore({url: ":memory:"}),
  logger: new PinoLogger({name: "JIXO-on-Mastra", level: "info"}),
});

// --- JIXO执行器 ---
async function runJixoOuterLoop() {
  await logManager.init("jixo-demo-job", "---\ntitle: _待定_\nprogress: '0%'\n---\n\n## Roadmap\n\n## Work Log\n");

  const MAX_LOOP_TIMES = 10;
  let currentTimes = 1;
  const jobName = "jixo-demo-job";
  const jobGoal = "Refactor the project's logging service to be more modular and add structured logging.";

  while (currentTimes <= MAX_LOOP_TIMES) {
    console.log("\n" + "─".repeat(process.stdout.columns) + `\n JIXO Outer Loop - Run #${currentTimes}\n` + "─".repeat(process.stdout.columns));

    const run = mastra.getWorkflow("jixoJobWorkflow").createRun();
    const result = await run.start({
      inputData: {jobName, jobGoal, runnerId: `${jobName}-runner-${currentTimes}`, otherRunners: []},
    });

    console.log(`[Outer Loop] Workflow finished with status: ${result.status}`);
    if (result.status === "success") {
      const finalOutput = result.result;
      if (finalOutput?.status === "Exited" && finalOutput.reason.includes("All tasks completed")) {
        console.log("[Outer Loop] Job completed. Exiting loop.");
        break;
      }
    }
    currentTimes++;
    await delay(2000);
  }
}

runJixoOuterLoop();
