import {Agent} from "@mastra/core";
import {createHash} from "node:crypto";
import _fs from "node:fs";
import path from "node:path";
import {z} from "zod";
import {zodToJsonSchema} from "zod-to-json-schema";
import {DELETE_FIELD_MARKER, type LogFileData, LogFileSchema, type RoadmapTaskNodeData, SubTaskSchema, type WorkLogEntryData} from "../entities.js";
import {thinkModel} from "../llm/index.js";
import {createTask, findTask, findTaskByPath} from "./logHelper.js";
import {serializeLogFile} from "./logSerializer.js";

const fsp = _fs.promises;
const LOG_FILE_DIR = path.join(process.cwd(), ".jixo");
const CACHE_DIR = path.join(LOG_FILE_DIR, "cache");

const EMPTY_JOB_CONTENT = `---
title: _undefined_
progress: '0%'
---

## Roadmap

## Work Log

`;

export type NewTaskInput = z.infer<typeof import("../agent/schemas.js").PlannerOutputSchema>["tasks"][number];

export type NextActionableTaskResult = {
  type: "review" | "execute" | "none";
  task: RoadmapTaskNodeData | import("../entities.js").SubTaskData | null;
};

class LogManager {
  private _parserAgent;
  private _locks = new Map<string, boolean>();

  constructor() {
    this._parserAgent = new Agent({
      name: "ParserAgent_Internal",
      instructions: `You are a highly-structured data parser. Your task is to receive a Markdown file content with YAML front matter and convert it into a valid JSON object that strictly adheres to the provided Zod schema. You must extract the front matter fields AND parse the 'Roadmap' and 'Work Log' sections. The 'Roadmap' is a nested Markdown checklist. Your output MUST be ONLY the JSON object, without any surrounding text or markdown backticks.
      The Zod schema for the output is:
      ${JSON.stringify(zodToJsonSchema(LogFileSchema), null, 2)}`,
      model: thinkModel,
    });
  }

  // --- Private Low-Level Methods (I/O and Locking) ---
  private _getLogFilePath = (jobName: string) => path.join(LOG_FILE_DIR, `${jobName}.log.md`);
  private _getCacheFilePath = (hash: string) => path.join(CACHE_DIR, `${hash}.json`);

  private async _lock(jobName: string) {
    while (this._locks.get(jobName)) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    this._locks.set(jobName, true);
  }

  private _unlock(jobName: string) {
    this._locks.set(jobName, false);
  }

  private async _readFileWithHash(filePath: string): Promise<{content: string; hash: string}> {
    let content: string;
    try {
      content = await fsp.readFile(filePath, "utf-8");
    } catch {
      content = EMPTY_JOB_CONTENT;
    }
    const hash = createHash("sha256").update(content).digest("hex");
    return {content, hash};
  }

  // --- Public High-Level API ---

  public async init(jobName: string) {
    await fsp.mkdir(CACHE_DIR, {recursive: true});
    const logFilePath = this._getLogFilePath(jobName);
    if (!_fs.existsSync(logFilePath)) {
      await fsp.writeFile(logFilePath, EMPTY_JOB_CONTENT);
    }
  }

  public async getLogFile(jobName: string): Promise<LogFileData> {
    const filePath = this._getLogFilePath(jobName);
    const {content, hash} = await this._readFileWithHash(filePath);
    const cachePath = this._getCacheFilePath(hash);
    try {
      const cachedData = await fsp.readFile(cachePath, "utf-8");
      return LogFileSchema.parse(JSON.parse(cachedData));
    } catch {
      const result = await this._parserAgent.generate(content, {output: LogFileSchema});
      const parsedData = result.object;
      await fsp.writeFile(cachePath, JSON.stringify(parsedData, null, 2));
      return parsedData;
    }
  }

  private async updateLogFile(jobName: string, data: LogFileData): Promise<void> {
    const validatedData = LogFileSchema.parse(data);
    const markdownContent = serializeLogFile(validatedData);
    const hash = createHash("sha256").update(markdownContent).digest("hex");
    await fsp.writeFile(this._getLogFilePath(jobName), markdownContent, "utf-8");
    await fsp.writeFile(this._getCacheFilePath(hash), JSON.stringify(validatedData, null, 2), "utf-8");
  }

  public async findTask(
    predicate: (task: RoadmapTaskNodeData | import("../entities.js").SubTaskData) => boolean | undefined,
    jobName: string,
  ): Promise<RoadmapTaskNodeData | import("../entities.js").SubTaskData | null> {
    const logData = await this.getLogFile(jobName);
    return findTask(predicate, logData.roadmap);
  }

  public async getNextActionableTask(jobName: string): Promise<NextActionableTaskResult> {
    const logData = await this.getLogFile(jobName);
    const {roadmap} = logData;

    const taskToReview = findTask((t) => t.status === "PendingReview", roadmap);
    if (taskToReview) {
      return {type: "review", task: taskToReview};
    }

    const allTasksMap = new Map<string, RoadmapTaskNodeData | import("../entities.js").SubTaskData>();
    roadmap.forEach((t) => {
      allTasksMap.set(t.id, t);
      t.children.forEach((st) => allTasksMap.set(st.id, st));
    });

    const pendingTask = findTask((t) => t.status === "Pending" && (t.dependsOn ?? []).every((depId) => allTasksMap.get(depId)?.status === "Completed"), roadmap);

    if (pendingTask) {
      return {type: "execute", task: pendingTask};
    }

    return {type: "none", task: null};
  }

  public async addTask(jobName: string, parentPath: string, taskInput: NewTaskInput): Promise<RoadmapTaskNodeData> {
    await this._lock(jobName);
    try {
      const logData = await this.getLogFile(jobName);

      if (parentPath === "") {
        // Adding a new root task
        const createdTask = createTask(taskInput, logData.roadmap);
        await this.updateLogFile(jobName, logData);
        return structuredClone(createdTask);
      } else {
        // Adding sub-tasks to an existing root task
        const {task: parentTask} = findTaskByPath(logData.roadmap, parentPath);
        if (!parentTask || !("children" in parentTask)) {
          throw new Error(`Parent task '${parentPath}' not found or is not a root task.`);
        }

        const subTaskId = `${parentTask.id}.${parentTask.children.length + 1}`;
        const newSubTask = SubTaskSchema.parse({
          ...taskInput,
          id: subTaskId,
          status: "Pending",
        });
        parentTask.children.push(newSubTask);
        await this.updateLogFile(jobName, logData);
        return structuredClone(parentTask as RoadmapTaskNodeData);
      }
    } finally {
      this._unlock(jobName);
    }
  }

  public async updateTask(
    jobName: string,
    path: string,
    updates: Partial<Omit<RoadmapTaskNodeData, "id" | "children">>,
  ): Promise<RoadmapTaskNodeData | import("../entities.js").SubTaskData> {
    await this._lock(jobName);
    try {
      const logData = await this.getLogFile(jobName);
      const {task} = findTaskByPath(logData.roadmap, path);
      if (!task) throw new Error(`Task with path '${path}' not found.`);

      for (const key in updates) {
        const value = updates[key as keyof typeof updates];
        if (value === DELETE_FIELD_MARKER) {
          delete (task as any)[key as keyof typeof task];
        } else {
          Object.assign(task, {[key]: value});
        }
      }
      await this.updateLogFile(jobName, logData);
      return structuredClone(task);
    } finally {
      this._unlock(jobName);
    }
  }

  public async addWorkLog(jobName: string, entry: WorkLogEntryData): Promise<void> {
    await this._lock(jobName);
    try {
      const logData = await this.getLogFile(jobName);
      logData.workLog.unshift(entry);
      await this.updateLogFile(jobName, logData);
    } finally {
      this._unlock(jobName);
    }
  }
}

export const logManager = new LogManager();
