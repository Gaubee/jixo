import {obj_props, pureEvent} from "@gaubee/util";
import {type Agent} from "@mastra/core/agent";
import fsp from "node:fs/promises";
import type {NewSubTaskData, NewTaskData} from "../agent/schemas.js";
import {
  DELETE_FIELD_MARKER,
  type JobInfoData,
  type LogFileData,
  LogFileSchema,
  type RoadmapTaskNodeData,
  type SubTaskData,
  SubTaskSchema,
  type WorkLogEntryData,
} from "../entities.js";
import {calcContentHash, getCacheFilePath, getLogFilePath} from "./internal.js";
import {createTask, findTask, findTaskByPath, isJobCompleted} from "./logHelper.js";
import {serializeLogFile} from "./logSerializer.js";

export type NextActionableTaskResult = {
  type: "review" | "execute" | "none";
  task: RoadmapTaskNodeData | SubTaskData | null;
};

export class LogManager {
  readonly onJobDirChanged = pureEvent<{oldDir: string; newDir: string}>();
  private _locks = new Map<string, boolean>();
  private parserAgent: Agent;

  constructor(
    private jobName: string,
    private logData: LogFileData,
    parserAgent: Agent,
    private workspaceDir: string, // Added workspaceDir
  ) {
    this.parserAgent = parserAgent;
  }

  private async _lock() {
    while (this._locks.get(this.jobName)) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    this._locks.set(this.jobName, true);
  }

  private _unlock() {
    this._locks.set(this.jobName, false);
  }

  get jobDir(): string {
    return this.logData.info.jobDir;
  }

  private async _persist() {
    const validatedData = LogFileSchema.parse(this.logData);
    const markdownContent = serializeLogFile(validatedData);
    const hash = calcContentHash(markdownContent);
    // Use workspaceDir for physical storage path
    const logFilePath = getLogFilePath(this.workspaceDir, this.jobName);
    const cachePath = getCacheFilePath(this.workspaceDir, hash);
    await fsp.writeFile(logFilePath, markdownContent, "utf-8");
    await fsp.writeFile(cachePath, JSON.stringify(validatedData, null, 2), "utf-8");
  }

  public async reload(): Promise<void> {
    // Use workspaceDir to read the log file
    const logFilePath = getLogFilePath(this.workspaceDir, this.jobName);
    const content = await fsp.readFile(logFilePath, "utf-8");
    const hash = calcContentHash(content);
    const cachePath = getCacheFilePath(this.workspaceDir, hash);

    try {
      const cachedData = await fsp.readFile(cachePath, "utf-8");
      this.logData = LogFileSchema.parse(JSON.parse(cachedData));
    } catch {
      const result = await this.parserAgent.generate(content, {output: LogFileSchema});
      this.logData = result.object;
      await fsp.writeFile(cachePath, JSON.stringify(this.logData, null, 2));
    }
  }

  public getLogFile(): LogFileData {
    return structuredClone(this.logData);
  }

  public getJobInfo(): JobInfoData {
    return structuredClone(this.logData.info);
  }

  /**
   * @internal
   */
  public async updateJobInfo(updates: Partial<JobInfoData>): Promise<JobInfoData> {
    await this._lock();
    const oldJobDir = this.logData.info.jobDir;
    try {
      this.logData.info = {...this.logData.info, ...updates};
      await this._persist();
      const newJobDir = this.logData.info.jobDir;
      if (oldJobDir !== newJobDir) {
        this.onJobDirChanged.emit({oldDir: oldJobDir, newDir: newJobDir});
      }
      return this.getJobInfo();
    } finally {
      this._unlock();
    }
  }

  public findTask(predicate: (task: RoadmapTaskNodeData | SubTaskData) => boolean | undefined): RoadmapTaskNodeData | SubTaskData | null {
    return findTask(predicate, this.logData.roadmap);
  }

  public getNextActionableTask(): NextActionableTaskResult {
    const {roadmap} = this.logData;

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

  public isJobCompleted(): boolean {
    return isJobCompleted(this.logData);
  }

  public async addTask(taskInput: NewTaskData): Promise<RoadmapTaskNodeData> {
    await this._lock();
    try {
      const createdTask = createTask(taskInput, this.logData.roadmap);
      await this._persist();
      return structuredClone(createdTask);
    } finally {
      this._unlock();
    }
  }

  public async addSubTask(parentId: string, subTaskInput: NewSubTaskData): Promise<SubTaskData> {
    await this._lock();
    try {
      const {task: parentTask} = findTaskByPath(this.logData.roadmap, parentId);
      if (!parentTask || !("children" in parentTask)) {
        throw new Error(`Parent task '${parentId}' not found or is not a root task.`);
      }
      const subTaskId = `${parentTask.id}.${parentTask.children.length + 1}`;
      const newSubTask = SubTaskSchema.parse({...subTaskInput, id: subTaskId, status: "Pending"});
      parentTask.children.push(newSubTask);
      await this._persist();
      return structuredClone(newSubTask);
    } finally {
      this._unlock();
    }
  }

  public async updateTask(path: string, updates: Partial<Omit<RoadmapTaskNodeData, "id" | "children">>): Promise<RoadmapTaskNodeData | SubTaskData> {
    await this._lock();
    try {
      const {task} = findTaskByPath(this.logData.roadmap, path);
      if (!task) throw new Error(`Task with path '${path}' not found.`);

      for (const key of obj_props(updates)) {
        const value = updates[key];
        if (value === DELETE_FIELD_MARKER) {
          delete task[key as keyof typeof task];
        } else {
          (task as any)[key] = value;
        }
      }

      await this._persist();
      return structuredClone(task);
    } finally {
      this._unlock();
    }
  }

  public async addWorkLog(entry: WorkLogEntryData): Promise<void> {
    await this._lock();
    try {
      this.logData.workLog.unshift(entry);
      await this._persist();
    } finally {
      this._unlock();
    }
  }
}
