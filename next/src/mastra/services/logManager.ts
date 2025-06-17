import {type Agent} from "@mastra/core/agent";
import fsp from "node:fs/promises";
import type {NewSubTaskData, NewTaskData} from "../agent/schemas.js";
import {DELETE_FIELD_MARKER, type LogFileData, LogFileSchema, type RoadmapTaskNodeData, type SubTaskData, SubTaskSchema, type WorkLogEntryData} from "../entities.js";
import {calcContentHash, getCacheFilePath, getLogFilePath} from "./internal.js";
import {createTask, findTask, findTaskByPath, isJobCompleted} from "./logHelper.js";
import {serializeLogFile} from "./logSerializer.js";

export type NextActionableTaskResult = {
  type: "review" | "execute" | "none";
  task: RoadmapTaskNodeData | SubTaskData | null;
};

/**
 * Manages the state and persistence of a single job's log file.
 * Instances should be created via the `logManagerFactory`.
 */
export class LogManager {
  private _locks = new Map<string, boolean>();
  private parserAgent: Agent;

  /**
   * @internal - Should be constructed via `logManagerFactory.getOrCreate`.
   */
  constructor(
    private jobName: string,
    private logData: LogFileData,
    parserAgent: Agent,
  ) {
    this.parserAgent = parserAgent;
  }

  // --- Private Low-Level Methods (I/O and Locking) ---

  private async _lock() {
    while (this._locks.get(this.jobName)) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    this._locks.set(this.jobName, true);
  }

  private _unlock() {
    this._locks.set(this.jobName, false);
  }

  private async _persist() {
    const validatedData = LogFileSchema.parse(this.logData);
    const markdownContent = serializeLogFile(validatedData);
    const hash = calcContentHash(markdownContent);
    const logFilePath = getLogFilePath(this.jobName);
    const cachePath = getCacheFilePath(hash);
    await fsp.writeFile(logFilePath, markdownContent, "utf-8");
    await fsp.writeFile(cachePath, JSON.stringify(validatedData, null, 2), "utf-8");
  }

  // --- Public High-Level API ---

  /**
   * Forces a reload of the log file from disk, overwriting the current in-memory state.
   */
  public async reload(): Promise<void> {
    const logFilePath = getLogFilePath(this.jobName);
    const content = await fsp.readFile(logFilePath, "utf-8");
    const hash = calcContentHash(content);
    const cachePath = getCacheFilePath(hash);

    try {
      const cachedData = await fsp.readFile(cachePath, "utf-8");
      this.logData = LogFileSchema.parse(JSON.parse(cachedData));
    } catch {
      const result = await this.parserAgent.generate(content, {output: LogFileSchema});
      this.logData = result.object;
      await fsp.writeFile(cachePath, JSON.stringify(this.logData, null, 2));
    }
  }

  /**
   * Returns a deep clone of the current in-memory log file data.
   */
  public getLogFile(): LogFileData {
    return structuredClone(this.logData);
  }

  /**
   * Finds a task in the roadmap using a predicate function.
   * @param predicate Function to test each task.
   * @returns The found task or null.
   */
  public findTask(predicate: (task: RoadmapTaskNodeData | SubTaskData) => boolean | undefined): RoadmapTaskNodeData | SubTaskData | null {
    return findTask(predicate, this.logData.roadmap);
  }

  /**
   * Determines the next actionable task based on the current roadmap state.
   * @returns An object indicating the action type ('review', 'execute', 'none') and the relevant task.
   */
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

  /**
   * Checks if all tasks in the roadmap are either Completed or Cancelled.
   * @returns True if the job is complete, false otherwise.
   */
  public isJobCompleted(): boolean {
    return isJobCompleted(this.logData);
  }

  /**
   * Adds a new root-level task to the roadmap.
   * @param taskInput The data for the new task.
   * @returns A clone of the newly created task.
   */
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

  /**
   * Adds a new sub-task to an existing root-level task.
   * @param parentId The ID of the parent task.
   * @param subTaskInput The data for the new sub-task.
   * @returns A clone of the newly created sub-task.
   */
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

  /**
   * Updates an existing task or sub-task in the roadmap.
   * @param path The ID path of the task to update (e.g., "1" or "1.2").
   * @param updates A partial object of fields to update.
   * @returns A clone of the updated task.
   */
  public async updateTask(path: string, updates: Partial<Omit<RoadmapTaskNodeData, "id" | "children">>): Promise<RoadmapTaskNodeData | SubTaskData> {
    await this._lock();
    try {
      const {task} = findTaskByPath(this.logData.roadmap, path);
      if (!task) throw new Error(`Task with path '${path}' not found.`);

      // Special handling for DELETE_FIELD_MARKER to remove optional properties
      for (const key in updates) {
        if (Object.prototype.hasOwnProperty.call(updates, key)) {
          const value = updates[key as keyof typeof updates];
          if (value === DELETE_FIELD_MARKER) {
            delete task[key as keyof typeof task];
          } else {
            (task as any)[key] = value;
          }
        }
      }

      await this._persist();
      return structuredClone(task);
    } finally {
      this._unlock();
    }
  }

  /**
   * Adds a new work log entry to the beginning of the work log.
   * @param entry The work log entry data.
   */
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
