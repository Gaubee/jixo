import type {LogFileData, RoadmapTaskNodeData} from "../entities.js";

/**
 * Recursively searches for a task within a tree structure that satisfies a predicate.
 * @param predicate A function that returns true for the desired task.
 * @param tasks The array of tasks to search through.
 * @returns The found task node, or null if not found.
 */
export function findTask(predicate: (task: RoadmapTaskNodeData) => boolean | undefined, tasks: RoadmapTaskNodeData[]): RoadmapTaskNodeData | null {
  for (const task of tasks) {
    if (predicate(task)) return task;
    const found = findTask(predicate, task.children);
    if (found) return found;
  }
  return null;
}

/**
 * Finds a task node by its period-separated ID path (e.g., "1.2.1").
 * @param roadmap The root array of roadmap tasks.
 * @param path The ID path to search for.
 * @returns An object containing the found task, or null if not found.
 */
export function findTaskByPath(roadmap: RoadmapTaskNodeData[], path: string): {task: RoadmapTaskNodeData | null} {
  const parts = path.split(".").filter(Boolean);
  if (parts.length === 0) return {task: null};

  let currentTasks: RoadmapTaskNodeData[] = roadmap;
  let task: RoadmapTaskNodeData | null = null;
  for (const part of parts) {
    task = currentTasks.find((t) => t.id === part) ?? null;
    if (!task) return {task: null};
    currentTasks = task.children;
  }
  return {task};
}

/**
 * Recursively creates a full RoadmapTaskNodeData object from a NewTaskInput object.
 * This function assigns IDs and default statuses.
 * @param taskInput The input data for the task and its potential children.
 * @param parentChildrenList The list where the new task will be added.
 * @param parentId The ID of the parent task, used to construct the new ID.
 * @returns The fully constructed RoadmapTaskNodeData object.
 */
export function createTaskRecursive(taskInput: import("./logManager.js").NewTaskInput, parentChildrenList: RoadmapTaskNodeData[], parentId: string): RoadmapTaskNodeData {
  const {children: childInputs, ...restOfInput} = taskInput;

  const newId = parentId ? `${parentId}.${parentChildrenList.length + 1}` : `${parentChildrenList.length + 1}`;

  const newTask: RoadmapTaskNodeData = {
    ...restOfInput,
    id: newId,
    status: "Pending",
    children: [],
  };

  // Add the new task to its parent's list
  parentChildrenList.push(newTask);

  // If there are child inputs, recurse
  if (childInputs && childInputs.length > 0) {
    for (const childInput of childInputs) {
      createTaskRecursive(childInput, newTask.children, newTask.id);
    }
  }

  return newTask;
}
export const isJobCompleted = (log: LogFileData) => {
  if (!log.roadmap.length) return false;

  const flattenTasks = (tasks: LogFileData["roadmap"]): LogFileData["roadmap"] => {
    return tasks.flatMap((t) => [t, ...flattenTasks(t.children)]);
  };

  return flattenTasks(log.roadmap)
    .filter((t) => t.status !== "Cancelled")
    .every((t) => t.status === "Completed");
};
