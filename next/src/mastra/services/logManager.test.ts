import fsp from "node:fs/promises";
import {beforeEach, describe, expect, it} from "vitest";
import type {NewSubTaskData, NewTaskData} from "../agent/schemas.js";
import type {RoadmapTaskNodeData, SubTaskData, WorkLogEntryData} from "../entities.js";
import type {LogManager} from "./logManager.js";
import {logManagerFactory} from "./logManagerFactory.js";

const TEST_JOB_NAME = "test-job-for-logmanager";
let logManager: LogManager;

beforeEach(async () => {
  const {getLogFilePath, ensureJixoDirsExist} = await import("./internal.js");
  await ensureJixoDirsExist();
  const logFilePath = getLogFilePath(TEST_JOB_NAME);
  await fsp.unlink(logFilePath).catch(() => {});

  // Corrected: Pass a valid JobInfoData object
  logManager = await logManagerFactory.createIsolated(TEST_JOB_NAME, {jobGoal: "testonly", workDir: "/tmp/jixo-test"});
});

describe("LogManager Basic CRUD & Info", () => {
  it("should initialize and create an empty log file with initial info", async () => {
    const logData = logManager.getLogFile();
    const jobInfo = logData.info;
    // Corrected: `title` is no longer a top-level property
    expect(logData.roadmap).toEqual([]);
    expect(logData.workLog).toEqual([]);
    expect(jobInfo?.workDir).toBe("/tmp/jixo-test");
    // Corrected: The initial goal is passed during creation now
    expect(jobInfo?.jobGoal).toBe("testonly");
  });

  it("should update job info correctly", async () => {
    await logManager.updateJobInfo({jobGoal: "A new goal", workDir: "/new/dir"});
    const jobInfo = logManager.getJobInfo();
    expect(jobInfo?.jobGoal).toBe("A new goal");
    expect(jobInfo?.workDir).toBe("/new/dir");

    await logManager.reload();
    const reloadedInfo = logManager.getJobInfo();
    expect(reloadedInfo?.jobGoal).toBe("A new goal");
  });

  it("should add a root-level task without children", async () => {
    const title = "This is the first root task";
    const createdTask = await logManager.addTask({title});
    expect(createdTask.id).toBe("1");
    expect(createdTask.title).toBe(title);
    expect(createdTask.children).toEqual([]);

    await logManager.reload();
    const logData = logManager.getLogFile();
    expect(logData.roadmap).toHaveLength(1);
  });

  it("should add a root task with nested sub-tasks", async () => {
    const nestedTaskInput: NewTaskData = {
      title: "Parent Task",
      children: [{title: "Child 1"}, {title: "Child 2"}],
    };
    await logManager.addTask(nestedTaskInput);
    const logData = logManager.getLogFile();
    const parent = logData.roadmap[0];
    expect(parent.id).toBe("1");
    expect(parent.children).toHaveLength(2);
    expect(parent.children[0].id).toBe("1.1");
    expect(parent.children[1].id).toBe("1.2");
  });

  it("should add a sub-task to an existing root task using addSubTask", async () => {
    await logManager.addTask({title: "Root task"});
    const subTaskInput: NewSubTaskData = {title: "New Sub-task"};
    const newSubTask = await logManager.addSubTask("1", subTaskInput);

    expect(newSubTask.id).toBe("1.1");
    expect(newSubTask.title).toBe("New Sub-task");

    const logData = logManager.getLogFile();
    const rootTask = logData.roadmap[0];
    expect(rootTask.children).toHaveLength(1);
    expect(rootTask.children[0]).toEqual(newSubTask);
  });

  it("should update a root task and return the updated data", async () => {
    await logManager.addTask({title: "Task to be updated"});
    const updates = {status: "Completed" as const, executor: "test-executor"};
    const updatedTask = await logManager.updateTask("1", updates);
    expect(updatedTask.status).toBe("Completed");
    expect((updatedTask as RoadmapTaskNodeData).executor).toBe("test-executor");
  });

  it("should update a sub-task and return the updated data", async () => {
    await logManager.addTask({
      title: "Root",
      children: [{title: "Sub-task to update"}],
    });
    const updates = {status: "Locked" as const, executor: "sub-task-executor"};
    const updatedTask = await logManager.updateTask("1.1", updates);
    expect(updatedTask.status).toBe("Locked");
    expect((updatedTask as SubTaskData).executor).toBe("sub-task-executor");
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
    await logManager.addWorkLog(firstLogEntry);

    const secondLogEntry = {
      timestamp: new Date().toISOString(),
      runnerId: "test-runner-2",
      role: "Planner",
      objective: "Second Action",
      result: "Succeeded",
      summary: "Second log.",
    } satisfies WorkLogEntryData;
    await logManager.addWorkLog(secondLogEntry);

    const logData = logManager.getLogFile();
    expect(logData.workLog).toHaveLength(2);
    expect(logData.workLog[0]).toMatchObject(secondLogEntry);
    expect(logData.workLog[1]).toMatchObject(firstLogEntry);
  });
});

describe("logManager.getNextActionableTask", () => {
  it("should return 'none' for an empty roadmap", async () => {
    const result = logManager.getNextActionableTask();
    expect(result.type).toBe("none");
    expect(result.task).toBeNull();
  });

  it("should prioritize a task pending review over any other task", async () => {
    await logManager.addTask({title: "A pending task"});
    await logManager.addTask({title: "A task for review"});
    await logManager.updateTask("2", {status: "PendingReview"});

    const result = logManager.getNextActionableTask();
    expect(result.type).toBe("review");
    expect(result.task?.id).toBe("2");
  });

  it("should return an executable task when no review tasks are present", async () => {
    await logManager.addTask({title: "A pending task"});
    const result = logManager.getNextActionableTask();
    expect(result.type).toBe("execute");
    expect(result.task?.id).toBe("1");
  });

  it("should return the dependent task once its dependency is completed", async () => {
    await logManager.addTask({title: "Task 1"});
    await logManager.addTask({title: "Task 2", dependsOn: ["1"]});
    await logManager.updateTask("1", {status: "Completed"});

    const result = logManager.getNextActionableTask();
    expect(result.type).toBe("execute");
    expect(result.task?.id).toBe("2");
  });

  it("should return 'none' if the only pending task has an unmet dependency", async () => {
    await logManager.addTask({title: "Task 1"});
    await logManager.updateTask("1", {status: "Locked"});
    await logManager.addTask({title: "Task 2", dependsOn: ["1"]});

    const result = logManager.getNextActionableTask();
    expect(result.type).toBe("none");
  });

  it("should return 'none' if all tasks are completed", async () => {
    await logManager.addTask({title: "Task 1"});
    await logManager.updateTask("1", {status: "Completed"});
    const result = logManager.getNextActionableTask();
    expect(result.type).toBe("none");
  });
});
