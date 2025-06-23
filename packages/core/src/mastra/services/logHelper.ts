import type {NewTaskData} from "../agent/schemas.js";
import type {AnyTaskData, RoadmapTaskNodeData, SubTaskData} from "../entities.js";

/**
 * Searches for a task within a two-level hierarchy that satisfies a predicate.
 * @param predicate A function that returns true for the desired task.
 * @param tasks The array of root tasks to search through.
 * @returns The found task node, or null if not found.
 */
export function findTask(predicate: (task: RoadmapTaskNodeData | SubTaskData) => boolean | undefined, tasks: RoadmapTaskNodeData[]): RoadmapTaskNodeData | SubTaskData | null {
  for (const task of tasks) {
    // Only search one level deep.
    for (const subTask of task.children) {
      if (predicate(subTask)) return subTask;
    }
    if (predicate(task)) return task;
  }
  return null;
}

/**
 * Finds a task node by its period-separated ID path (e.g., "1" or "1.2").
 * @param roadmap The root array of roadmap tasks.
 * @param path The ID path to search for.
 * @returns An object containing the found task, or null if not found.
 */
export function findTaskByPath(roadmap: RoadmapTaskNodeData[], path: string): {task: RoadmapTaskNodeData | SubTaskData | null} {
  const parts = path.split(".").filter(Boolean);
  if (parts.length === 0 || parts.length > 2) return {task: null};

  const rootTask = roadmap.find((t) => t.id === parts[0]);
  if (!rootTask) return {task: null};

  if (parts.length === 1) {
    return {task: rootTask};
  } else {
    const subTask = rootTask.children.find((t) => t.id === path);
    return {task: subTask ?? null};
  }
}

/**
 * Creates a full RoadmapTaskNodeData object from a NewTaskInput object
 * and adds it to the provided list of root tasks.
 * @param taskInput The input data for the task and its potential children.
 * @param rootTasks The list where the new root task will be added.
 * @returns The fully constructed RoadmapTaskNodeData object.
 */
export function createTask(taskInput: NewTaskData, rootTasks: RoadmapTaskNodeData[]): RoadmapTaskNodeData {
  const {children: subTaskInputs, ...restOfInput} = taskInput;
  const newId = `${rootTasks.length + 1}`;

  const newTask: RoadmapTaskNodeData = {
    ...(restOfInput as Omit<typeof restOfInput, "children">),
    id: newId,
    status: "Pending",
    children: [],
  };

  rootTasks.push(newTask);

  if (subTaskInputs) {
    for (const subTaskInput of subTaskInputs) {
      const subTaskId = `${newId}.${newTask.children.length + 1}`;
      newTask.children.push({
        ...subTaskInput,
        id: subTaskId,
        status: "Pending",
      });
    }
  }

  return newTask;
}

export const isJobCompleted = (log: import("../entities.js").LogFileData) => {
  if (!log.roadmap.length) return false;
  for (const task of walkJobRoadmap(log.roadmap)) {
    const taskDone = task.status === "Completed" || task.status === "Cancelled";
    if (!taskDone) return false;
  }
  return true;
};

export function* walkJobRoadmap(roadmap: AnyTaskData[]) {
  for (const task of roadmap) {
    yield task;
    if ("children" in task) {
      for (const subTask of task.children) {
        yield subTask;
      }
    }
  }
}
