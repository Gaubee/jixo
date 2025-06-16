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
    // console.log(`[LogManager] Lock acquired for ${jobName}.`);
  }

  private _unlock(jobName: string) {
    this._locks.set(jobName, false);
    // console.log(`[LogManager] Lock released for ${jobName}.`);
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

  private async _findTaskByPath(roadmap: RoadmapTaskNodeData[], path: string): Promise<RoadmapTaskNodeData | null> {
    const parts = path.split(".").filter(Boolean);
    if (parts.length === 0) return null;

    let currentTasks: RoadmapTaskNodeData[] | undefined = roadmap;
    let foundTask: RoadmapTaskNodeData | null = null;

    for (const part of parts) {
      if (!currentTasks) return null;
      /**<!--[[这里使用id来索引，我觉得很不错，比index跟稳定，但你要确保创建的id不要太过复杂，假设你用hash，那么最多用4～6-hex长度的就够了。]]--> */
      const task: RoadmapTaskNodeData | undefined = currentTasks.find((t) => t.id === part);
      if (!task) return null;
      foundTask = task;
      currentTasks = task.children;
    }
    return foundTask;
  }

  // --- Public High-Level API ---

  public async init(jobName: string) {
    await fsp.mkdir(CACHE_DIR, {recursive: true});
    await fsp.writeFile(this._getLogFilePath(jobName), EMPTY_JOB_CONTENT);
  }

  /** Reads the log file, utilizing a cache to avoid re-parsing unchanged files. */
  public async getLogFile(jobName: string): Promise<LogFileData> {
    const filePath = this._getLogFilePath(jobName);
    const {content, hash} = await this._readFileWithHash(filePath);
    const cachePath = this._getCacheFilePath(hash);

    try {
      const cachedData = await fsp.readFile(cachePath, "utf-8");
      console.log(`[LogManager] Cache hit for job '${jobName}'.`);
      return LogFileSchema.parse(JSON.parse(cachedData));
    } catch {
      console.log(`[LogManager] Cache miss. Invoking ParserAgent for job '${jobName}'...`);
      const result = await this._parserAgent.generate(content, {output: LogFileSchema});
      const parsedData = result.object;
      await fsp.writeFile(cachePath, JSON.stringify(parsedData, null, 2));
      return parsedData;
    }
  }

  /** Updates the log file using a deterministic serializer and updates the cache. */
  private async updateLogFile(jobName: string, data: LogFileData): Promise<void> {
    const validatedData = LogFileSchema.parse(data);
    const markdownContent = serializeLogFile(validatedData);
    const hash = createHash("sha256").update(markdownContent).digest("hex");

    await fsp.writeFile(this._getLogFilePath(jobName), markdownContent, "utf-8");
    await fsp.writeFile(this._getCacheFilePath(hash), JSON.stringify(validatedData, null, 2), "utf-8");
    console.log(`[LogManager] Log file for job '${jobName}' updated.`);
  }

  /** Adds a new task to the roadmap at a specified parent path.
   * <!--[[
   * 这里我建议id是可选的，由addTask接口直接生成一个完整的ID。否则AI可能会生成同样的ID，会导致一些异常的可能，这不是AI擅长的事情。
   * 另外，如果id是可选的，那么我们就应该返回完整的ID，代表生成成功了。理论上也可以返回完整的 RoadmapTaskNodeData 对象，这样兼容性会更好一些。
   * 这样一来，一些参数都可以进一步省略，由addTask使用默认值进行补全返回。这样用input替代AI-output，成本还能进一步降低。
   * ]]-->
   */
  public async addTask(jobName: string, parentPath: string, taskData: RoadmapTaskNodeData): Promise<void> {
    await this._lock(jobName);
    try {
      const logData = await this.getLogFile(jobName);
      if (parentPath === "") {
        logData.roadmap.push(taskData);
      } else {
        const parentTask = await this._findTaskByPath(logData.roadmap, parentPath);
        if (!parentTask) throw new Error(`Parent task with path '${parentPath}' not found.`);
        parentTask.children = parentTask.children || [];
        parentTask.children.push(taskData);
      }
      await this.updateLogFile(jobName, logData);
    } finally {
      this._unlock(jobName);
    }
  }

  /** Updates a specific task in the roadmap.
   * <!--[[
   * 这里updateTask成功或者失败，都应该返回当前这个task的完整内容。提供最新的内容给AI，避免AI出现幻觉。AI的记忆也能更加可靠。
   * ]]-->
   */
  public async updateTask(jobName: string, path: string, updates: Partial<RoadmapTaskNodeData>): Promise<void> {
    await this._lock(jobName);
    try {
      const logData = await this.getLogFile(jobName);
      const task = await this._findTaskByPath(logData.roadmap, path);
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
    } finally {
      this._unlock(jobName);
    }
  }

  /** Appends a new entry to the work log. 
   * <!--[[
   * 理论上可以对齐addTask的设计，不过我个人觉得保持现状不做任何返回也挺好，因为addWorkLog本身就是一种“下班打卡”的行为，它输出完后，当前的agent就结束会话了，再返回记忆给它也没什么意义。
   * 如果你觉得对齐addTask接口的设计是有必要的，在重构后，请在注释中补全原因。
   * ]]-->
  */
  public async addWorkLog(jobName: string, entry: WorkLogEntryData): Promise<void> {
    await this._lock(jobName);
    try {
      const logData = await this.getLogFile(jobName);
      logData.workLog.unshift(entry); // Prepend to keep latest on top
      await this.updateLogFile(jobName, logData);
    } finally {
      this._unlock(jobName);
    }
  }
}

// Export a singleton instance for use across the application
export const logManager = new LogManager();
