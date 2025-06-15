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
    if (job.isCompleted) return {role: "Exit", reason: "All tasks completed successfully.", job, payload: {exitCode: 0}};
    const pendingTask = job.pendingTask;
    if (pendingTask) return {role: "Runner", reason: `Found pending task: ${pendingTask.id}.`, job, payload: {task: pendingTask}};
    return {role: "Planner", reason: "No pending tasks found. Planning new tasks.", job};
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
    // 从 `getInitData()` 获取最顶层工作流的输入，从而安全地拿到当前轮次的 runnerId。
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
  const MAX_LOOP_TIMES = 5;
  let currentTimes = 1;
  const jobName = "jixo-demo-job";
  await logManager.init(jobName, "---\ntitle: _待定_\nprogress: '0%'\n---\n\n## Roadmap\n\n## Work Log\n");

  while (currentTimes <= MAX_LOOP_TIMES) {
    console.log("\n" + "─".repeat(process.stdout.columns) + `\n JIXO Outer Loop - Run #${currentTimes}\n` + "─".repeat(process.stdout.columns));
    const run = mastra.getWorkflow("jixoJobWorkflow").createRun();
    const result = await run.start({
      inputData: {jobName, runnerId: `${jobName}-runner-${currentTimes}`, otherRunners: []},
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
