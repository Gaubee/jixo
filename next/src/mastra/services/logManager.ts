import {Agent} from "@mastra/core";
import fs from "node:fs";
import fsp from "node:fs/promises";
import type {NewSubTaskData, NewTaskData} from "../agent/schemas.js";
import {type LogFileData, LogFileSchema, type RoadmapTaskNodeData, type SubTaskData, SubTaskSchema, type WorkLogEntryData} from "../entities.js";
import {thinkModel} from "../llm/index.js";
import {calcContentHash, EMPTY_JOB_CONTENT, ensureJixoDirsExist, getCacheFilePath, getLogFilePath} from "./internal.js";
import {createTask, findTask, findTaskByPath} from "./logHelper.js";
import {serializeLogFile} from "./logSerializer.js";

export type NextActionableTaskResult = {
  type: "review" | "execute" | "none";
  task: RoadmapTaskNodeData | SubTaskData | null;
};

class LogManager {
  private _parserAgent;
  private _locks = new Map<string, boolean>();

  constructor() {
    this._parserAgent = new Agent({
      name: "ParserAgent_Internal",
      instructions: `You are a highly-structured data parser. Your task is to receive a Markdown file content with YAML front matter and convert it into a valid JSON object that strictly adheres to the provided Zod schema. You must extract the front matter fields AND parse the 'Roadmap' and 'Work Log' sections. The 'Roadmap' is a nested Markdown checklist. Your output MUST be ONLY the JSON object, without any surrounding text or markdown backticks.`, // Truncated for brevity
      model: thinkModel,
    });
  }

  // --- Private Low-Level Methods (I/O and Locking) ---
  private async _lock(jobName: string) {
    while (this._locks.get(jobName)) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    this._locks.set(jobName, true);
  }

  private _unlock(jobName: string) {
    this._locks.set(jobName, false);
  }

  private async _readFileWithHash(jobName: string): Promise<{content: string; hash: string}> {
    const filePath = getLogFilePath(jobName);
    let content: string;
    try {
      content = await fsp.readFile(filePath, "utf-8");
    } catch {
      content = EMPTY_JOB_CONTENT;
    }
    const hash = calcContentHash(content);
    return {content, hash};
  }

  // --- Public High-Level API ---

  public async init(jobName: string) {
    await ensureJixoDirsExist();
    const logFilePath = getLogFilePath(jobName);
    if (!fs.existsSync(logFilePath)) {
      await fsp.writeFile(logFilePath, EMPTY_JOB_CONTENT);
    }
  }

  public async getLogFile(jobName: string): Promise<LogFileData> {
    const {content, hash} = await this._readFileWithHash(jobName);
    const cachePath = getCacheFilePath(hash);
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
    const hash = calcContentHash(markdownContent);
    const logFilePath = getLogFilePath(jobName);
    const cachePath = getCacheFilePath(hash);
    await fsp.writeFile(logFilePath, markdownContent, "utf-8");
    await fsp.writeFile(cachePath, JSON.stringify(validatedData, null, 2), "utf-8");
  }

  public async findTask(predicate: (task: RoadmapTaskNodeData | SubTaskData) => boolean | undefined, jobName: string): Promise<RoadmapTaskNodeData | SubTaskData | null> {
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
    const allTasksMap = new Map<string, RoadmapTaskNodeData | SubTaskData>();
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

  public async addTask(jobName: string, taskInput: NewTaskData): Promise<RoadmapTaskNodeData> {
    await this._lock(jobName);
    try {
      const logData = await this.getLogFile(jobName);
      const createdTask = createTask(taskInput, logData.roadmap);
      await this.updateLogFile(jobName, logData);
      return structuredClone(createdTask);
    } finally {
      this._unlock(jobName);
    }
  }

  public async addSubTask(jobName: string, parentId: string, subTaskInput: NewSubTaskData): Promise<SubTaskData> {
    await this._lock(jobName);
    try {
      const logData = await this.getLogFile(jobName);
      const {task: parentTask} = findTaskByPath(logData.roadmap, parentId);
      if (!parentTask || !("children" in parentTask)) {
        throw new Error(`Parent task '${parentId}' not found or is not a root task.`);
      }
      const subTaskId = `${parentTask.id}.${parentTask.children.length + 1}`;
      const newSubTask = SubTaskSchema.parse({...subTaskInput, id: subTaskId, status: "Pending"});
      parentTask.children.push(newSubTask);
      await this.updateLogFile(jobName, logData);
      return structuredClone(newSubTask);
    } finally {
      this._unlock(jobName);
    }
  }

  public async updateTask(jobName: string, path: string, updates: Partial<Omit<RoadmapTaskNodeData, "id" | "children">>): Promise<RoadmapTaskNodeData | SubTaskData> {
    await this._lock(jobName);
    try {
      const logData = await this.getLogFile(jobName);
      const {task} = findTaskByPath(logData.roadmap, path);
      if (!task) throw new Error(`Task with path '${path}' not found.`);
      Object.assign(task, updates);
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
