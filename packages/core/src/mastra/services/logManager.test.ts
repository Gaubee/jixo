import {randomUUID} from "node:crypto";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {beforeEach, describe, expect, it} from "vitest";
import type {NewSubTaskData, NewTaskData} from "../agent/schemas.js";
import type {RoadmapTaskNodeData, SubTaskData, WorkLogEntryData} from "../entities.js";
import type {LogManager} from "./logManager.js";
import {WorkspaceManager} from "./workspaceManager.js";

const TEST_JOB_NAME = "test-job-for-logmanager";
const workspaceDir = path.join(os.tmpdir(), "jixo-tests", randomUUID());
let logManager: LogManager;

beforeEach(async () => {
  const {ensureJixoDirsExist} = await import("./internal.js");
  await fsp.rm(workspaceDir, {recursive: true, force: true});
  await ensureJixoDirsExist(workspaceDir);

  const workspaceManager = new WorkspaceManager(workspaceDir);
  logManager = await workspaceManager.createJob(TEST_JOB_NAME, "test only for logManager");
});

const newTask = (title: string, args?: Partial<NewTaskData>): NewTaskData => ({title, description: "", details: [], checklist: [], ...args});

describe("LogManager", () => {
  it("should initialize with correct job info", async () => {
    const jobInfo = logManager.getJobInfo();
    expect(jobInfo.jobName).toBe(TEST_JOB_NAME);
    expect(jobInfo.jobGoal).toBe("test only for logManager");
  });

  it("should not allow jobDir to be updated via updateJobInfo", async () => {
    const oldJobInfo = logManager.getJobInfo();
    await (logManager as any).updateJobInfo({jobGoal: "A new goal"});
    const newJobInfo = logManager.getJobInfo();
    expect(newJobInfo.jobGoal).toBe("A new goal");
    expect(newJobInfo.jobDir).toBe(oldJobInfo.jobDir);
  });

  it("should add a root-level task without children", async () => {
    const title = "This is the first root task";
    const createdTask = await logManager.addTask(newTask(title));
    expect(createdTask.id).toBe("1");
    expect(createdTask.title).toBe(title);
    expect(createdTask.children).toEqual([]);

    await logManager.reload();
    const logData = logManager.getLogFile();
    expect(logData.roadmap).toHaveLength(1);
  });

  it("should add a root task with nested sub-tasks", async () => {
    const nestedTaskInput: NewTaskData = newTask("Parent Task", {
      children: [newTask("Child 1"), newTask("Child 2")],
    });
    await logManager.addTask(nestedTaskInput);
    const logData = logManager.getLogFile();
    const parent = logData.roadmap[0];
    expect(parent.id).toBe("1");
    expect(parent.children).toHaveLength(2);
    expect(parent.children[0].id).toBe("1.1");
    expect(parent.children[1].id).toBe("1.2");
  });

  it("should add a sub-task to an existing root task using addSubTask", async () => {
    await logManager.addTask(newTask("Root task"));
    const subTaskInput: NewSubTaskData = newTask("New Sub-task");
    const newSubTask = await logManager.addSubTask("1", subTaskInput);

    expect(newSubTask.id).toBe("1.1");
    expect(newSubTask.title).toBe("New Sub-task");

    const logData = logManager.getLogFile();
    const rootTask = logData.roadmap[0];
    expect(rootTask.children).toHaveLength(1);
    expect(rootTask.children[0]).toEqual(newSubTask);
  });

  it("should update a root task and return the updated data", async () => {
    await logManager.addTask(newTask("Task to be updated"));
    const updates = {status: "Completed" as const, executor: "test-executor"};
    const updatedTask = await logManager.updateTask("1", updates);
    expect(updatedTask.status).toBe("Completed");
    expect((updatedTask as RoadmapTaskNodeData).executor).toBe("test-executor");
  });

  it("should update a sub-task and return the updated data", async () => {
    await logManager.addTask(
      newTask("Root", {
        children: [newTask("Sub-task to update")],
      }),
    );
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
