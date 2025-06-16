import _fs from "node:fs";
import path from "node:path";
import {beforeEach, describe, expect, it} from "vitest";
import type {RoadmapTaskNodeData, SubTaskData, WorkLogEntryData} from "../entities.js";
import {logManager, type NewTaskInput} from "./logManager.js";

const TEST_JOB_NAME = "test-job-for-logmanager";
const LOG_FILE_DIR = path.join(process.cwd(), ".jixo");

// Clean up and initialize before each test to ensure isolation.
beforeEach(async () => {
  const logFilePath = path.join(LOG_FILE_DIR, `${TEST_JOB_NAME}.log.md`);
  if (_fs.existsSync(logFilePath)) {
    await _fs.promises.unlink(logFilePath);
  }
  await logManager.init(TEST_JOB_NAME);
});

describe("LogManager Basic CRUD", () => {
  it("should initialize and create an empty log file", async () => {
    const logData = await logManager.getLogFile(TEST_JOB_NAME);
    expect(logData.title).toBe("_undefined_");
    expect(logData.roadmap).toEqual([]);
    expect(logData.workLog).toEqual([]);
  });

  it("should add a root-level task without children and return its full data", async () => {
    const title = "This is the first root task";
    const createdTask = await logManager.addTask(TEST_JOB_NAME, "", {title});

    expect(createdTask.id).toBe("1");
    expect(createdTask.title).toBe(title);
    expect(createdTask.status).toBe("Pending");
    expect(createdTask.children).toEqual([]);

    const logData = await logManager.getLogFile(TEST_JOB_NAME);
    expect(logData.roadmap).toHaveLength(1);
    expect(logData.roadmap[0]).toEqual(createdTask);
  });

  it("should add a root task with nested sub-tasks", async () => {
    const nestedTaskInput: NewTaskInput = {
      title: "Parent Task",
      children: [{title: "Child 1"}, {title: "Child 2"}],
    };

    await logManager.addTask(TEST_JOB_NAME, "", nestedTaskInput);

    const logData = await logManager.getLogFile(TEST_JOB_NAME);
    const parent = logData.roadmap[0];

    expect(parent.id).toBe("1");
    expect(parent.title).toBe("Parent Task");
    expect(parent.children).toHaveLength(2);

    const child1 = parent.children[0];
    const child2 = parent.children[1];

    expect(child1.id).toBe("1.1");
    expect(child1.title).toBe("Child 1");
    expect(child2.id).toBe("1.2");
    expect(child2.title).toBe("Child 2");
  });

  it("should add a sub-task to an existing root task", async () => {
    await logManager.addTask(TEST_JOB_NAME, "", {title: "Root task"});
    const subTaskInput: NewTaskInput = {title: "New Sub-task"};
    await logManager.addTask(TEST_JOB_NAME, "1", subTaskInput);

    const logData = await logManager.getLogFile(TEST_JOB_NAME);
    const rootTask = logData.roadmap[0];
    expect(rootTask.children).toHaveLength(1);
    expect(rootTask.children[0].id).toBe("1.1");
    expect(rootTask.children[0].title).toBe("New Sub-task");
  });

  it("should update a root task and return the updated data", async () => {
    await logManager.addTask(TEST_JOB_NAME, "", {title: "Task to be updated"});
    const updates = {status: "Completed" as const, executor: "test-executor"};
    const updatedTask = await logManager.updateTask(TEST_JOB_NAME, "1", updates);

    expect(updatedTask.status).toBe("Completed");
    expect((updatedTask as RoadmapTaskNodeData).executor).toBe("test-executor");
  });

  it("should update a sub-task and return the updated data", async () => {
    await logManager.addTask(TEST_JOB_NAME, "", {
      title: "Root",
      children: [{title: "Sub-task to update"}],
    });
    const updates = {status: "Locked" as const, executor: "sub-task-executor"};
    const updatedTask = await logManager.updateTask(TEST_JOB_NAME, "1.1", updates);

    expect(updatedTask.status).toBe("Locked");
    expect((updatedTask as SubTaskData).executor).toBe("sub-task-executor");

    const logData = await logManager.getLogFile(TEST_JOB_NAME);
    expect(logData.roadmap[0].children[0].status).toBe("Locked");
  });

  it("should add a work log entry to the beginning of the log", async () => {
    const firstLogEntry = {
      timestamp: new Date().toISOString(),
      runnerId: "test-runner-1",
      role: "Executor",
      objective: "First Action",
      result: "Succeeded",
      summary: "First log.",
    } satisfies WorkLogEntryData;
    await logManager.addWorkLog(TEST_JOB_NAME, firstLogEntry);

    const secondLogEntry = {
      timestamp: new Date().toISOString(),
      runnerId: "test-runner-2",
      role: "Planner",
      objective: "Second Action",
      result: "Succeeded",
      summary: "Second log.",
    } satisfies WorkLogEntryData;
    await logManager.addWorkLog(TEST_JOB_NAME, secondLogEntry);

    const logData = await logManager.getLogFile(TEST_JOB_NAME);
    expect(logData.workLog).toHaveLength(2);
    expect(logData.workLog[0]).toMatchObject(secondLogEntry);
    expect(logData.workLog[1]).toMatchObject(firstLogEntry);
  });
});

describe("logManager.getNextActionableTask", () => {
  it("should return 'none' for an empty roadmap", async () => {
    const result = await logManager.getNextActionableTask(TEST_JOB_NAME);
    expect(result.type).toBe("none");
    expect(result.task).toBeNull();
  });

  it("should prioritize a task pending review over any other task", async () => {
    await logManager.addTask(TEST_JOB_NAME, "", {title: "A pending task"});
    await logManager.addTask(TEST_JOB_NAME, "", {title: "A task for review"});
    await logManager.updateTask(TEST_JOB_NAME, "2", {status: "PendingReview"});

    const result = await logManager.getNextActionableTask(TEST_JOB_NAME);
    expect(result.type).toBe("review");
    expect(result.task?.id).toBe("2");
  });

  it("should return an executable task when no review tasks are present", async () => {
    await logManager.addTask(TEST_JOB_NAME, "", {title: "A pending task"});
    const result = await logManager.getNextActionableTask(TEST_JOB_NAME);
    expect(result.type).toBe("execute");
    expect(result.task?.id).toBe("1");
  });

  it("should return the dependent task once its dependency is completed", async () => {
    await logManager.addTask(TEST_JOB_NAME, "", {title: "Task 1"});
    await logManager.addTask(TEST_JOB_NAME, "", {title: "Task 2", dependsOn: ["1"]});
    await logManager.updateTask(TEST_JOB_NAME, "1", {status: "Completed"});

    const result = await logManager.getNextActionableTask(TEST_JOB_NAME);
    expect(result.type).toBe("execute");
    expect(result.task?.id).toBe("2");
  });

  it("should return 'none' if the only pending task has an unmet dependency", async () => {
    await logManager.addTask(TEST_JOB_NAME, "", {title: "Task 1"});
    await logManager.updateTask(TEST_JOB_NAME, "1", {status: "Locked"});
    await logManager.addTask(TEST_JOB_NAME, "", {title: "Task 2", dependsOn: ["1"]});

    const result = await logManager.getNextActionableTask(TEST_JOB_NAME);
    expect(result.type).toBe("none");
  });

  it("should return 'none' if all tasks are completed", async () => {
    await logManager.addTask(TEST_JOB_NAME, "", {title: "Task 1"});
    await logManager.updateTask(TEST_JOB_NAME, "1", {status: "Completed"});
    const result = await logManager.getNextActionableTask(TEST_JOB_NAME);
    expect(result.type).toBe("none");
  });
});
