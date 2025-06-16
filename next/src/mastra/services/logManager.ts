import {Agent} from "@mastra/core";
import {createHash} from "node:crypto";
import _fs from "node:fs";
import path from "node:path";
import {zodToJsonSchema} from "zod-to-json-schema";
import {DELETE_FIELD_MARKER, type LogFileData, LogFileSchema, type RoadmapTaskNodeData, type WorkLogEntryData} from "../entities.js";
import {thinkModel} from "../llm/index.js";
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

// Type for the data required to create a new task.
// We only require the description from the AI.
export type NewTaskInput = Pick<RoadmapTaskNodeData, "description"> & Partial<Omit<RoadmapTaskNodeData, "id" | "status" | "children" | "description">>;

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

  // --- Private Low-Level Methods ---
  private _getLogFilePath = (jobName: string) => path.join(LOG_FILE_DIR, `${jobName}.log.md`);
  private _getCacheFilePath = (hash: string) => path.join(CACHE_DIR, `${hash}.json`);

  private async _lock(jobName: string) {
    while (this._locks.get(jobName)) {
      await new Promise((resolve) => setTimeout(resolve, 50)); // Simple spin lock
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

  private _findTaskByPath(roadmap: RoadmapTaskNodeData[], path: string): {task: RoadmapTaskNodeData | null} {
    const parts = path.split(".").filter(Boolean);
    if (parts.length === 0) return {task: null};

    let currentTasks: RoadmapTaskNodeData[] | undefined = roadmap;
    let task: RoadmapTaskNodeData | null = null;

    for (const part of parts) {
      if (!currentTasks) return {task: null};
      task = currentTasks.find((t) => t.id === part) ?? null;
      if (!task) return {task: null};
      currentTasks = task.children;
    }

    return {task};
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
      console.log(`[LogManager] Cache miss. Invoking ParserAgent for job '${jobName}'...`);
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

  public async addTask(jobName: string, parentPath: string, taskInput: NewTaskInput): Promise<RoadmapTaskNodeData> {
    await this._lock(jobName);
    try {
      const logData = await this.getLogFile(jobName);
      let targetChildrenList: RoadmapTaskNodeData[];
      let newId: string;

      if (parentPath === "") {
        targetChildrenList = logData.roadmap;
        newId = (targetChildrenList.length + 1).toString();
      } else {
        const {task: parentTask} = this._findTaskByPath(logData.roadmap, parentPath);
        if (!parentTask) throw new Error(`Parent task with path '${parentPath}' not found.`);
        parentTask.children = parentTask.children ?? []; // Handle optional children
        targetChildrenList = parentTask.children;
        newId = `${parentTask.id}.${targetChildrenList.length + 1}`;
      }

      const newTask: RoadmapTaskNodeData = {
        ...taskInput,
        id: newId,
        status: "Pending",
        children: [],
      };

      targetChildrenList.push(newTask);
      await this.updateLogFile(jobName, logData);
      return JSON.parse(JSON.stringify(newTask));
    } finally {
      this._unlock(jobName);
    }
  }

  public async updateTask(jobName: string, path: string, updates: Partial<Omit<RoadmapTaskNodeData, "id" | "children">>): Promise<RoadmapTaskNodeData> {
    await this._lock(jobName);
    try {
      const logData = await this.getLogFile(jobName);
      const {task} = this._findTaskByPath(logData.roadmap, path);
      if (!task) throw new Error(`Task with path '${path}' not found.`);

      for (const key in updates) {
        const value = updates[key as keyof typeof updates];
        if (value === DELETE_FIELD_MARKER) {
          delete task[key as keyof typeof task];
        } else {
          Object.assign(task, {[key]: value});
        }
      }
      await this.updateLogFile(jobName, logData);
      return JSON.parse(JSON.stringify(task));
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
