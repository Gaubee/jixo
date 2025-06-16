import _fs from "node:fs";
import path from "node:path";
import {beforeEach, describe, expect, it} from "vitest";
import {logManager} from "./logManager.js";

const TEST_JOB_NAME = "test-job-for-logmanager";
const LOG_FILE_DIR = path.join(process.cwd(), ".jixo");

// Clean up before each test
beforeEach(async () => {
  const logFilePath = path.join(LOG_FILE_DIR, `${TEST_JOB_NAME}.log.md`);
  if (_fs.existsSync(logFilePath)) {
    await _fs.promises.unlink(logFilePath);
  }
  // Clear cache related to the test job if necessary, for now we just delete the log
});

describe("LogManager", () => {
  it("should initialize and create an empty log file", async () => {
    await logManager.init(TEST_JOB_NAME);
    const logData = await logManager.getLogFile(TEST_JOB_NAME);
    expect(logData.title).toBe("_undefined_");
    expect(logData.roadmap).toEqual([]);
    expect(logData.workLog).toEqual([]);
  });

  it("should add a root-level task and return its full data", async () => {
    await logManager.init(TEST_JOB_NAME);
    const description = "This is the first root task";

    const createdTask = await logManager.addTask(TEST_JOB_NAME, "", {description});

    expect(createdTask.id).toBe("1");
    expect(createdTask.description).toBe(description);
    expect(createdTask.status).toBe("Pending");

    const logData = await logManager.getLogFile(TEST_JOB_NAME);
    expect(logData.roadmap).toHaveLength(1);
    expect(logData.roadmap[0]).toEqual(createdTask);
  });

  it("should add a child task and generate a nested ID", async () => {
    await logManager.init(TEST_JOB_NAME);
    await logManager.addTask(TEST_JOB_NAME, "", {description: "Root task"});

    const childDescription = "This is a child task";
    const childTask = await logManager.addTask(TEST_JOB_NAME, "1", {description: childDescription});

    expect(childTask.id).toBe("1.1");
    expect(childTask.description).toBe(childDescription);

    const logData = await logManager.getLogFile(TEST_JOB_NAME);
    expect(logData.roadmap[0].children).toHaveLength(1);
    expect(logData.roadmap[0].children[0]).toEqual(childTask);
  });

  it("should update a task and return the updated data", async () => {
    await logManager.init(TEST_JOB_NAME);
    await logManager.addTask(TEST_JOB_NAME, "", {description: "Task to be updated"});

    const updates = {status: "Completed" as const, runner: "test-runner"};
    const updatedTask = await logManager.updateTask(TEST_JOB_NAME, "1", updates);

    expect(updatedTask.status).toBe("Completed");
    expect(updatedTask.runner).toBe("test-runner");

    const logData = await logManager.getLogFile(TEST_JOB_NAME);
    expect(logData.roadmap[0].status).toBe("Completed");
  });

  it("should add a work log entry", async () => {
    await logManager.init(TEST_JOB_NAME);
    const logEntry = {
      timestamp: new Date().toISOString(),
      runnerId: "test-runner",
      role: "Runner" as const,
      objective: "Testing addWorkLog",
      result: "Succeeded" as const,
      summary: "The log was added.",
    };

    await logManager.addWorkLog(TEST_JOB_NAME, logEntry);

    const logData = await logManager.getLogFile(TEST_JOB_NAME);
    expect(logData.workLog).toHaveLength(1);
    // Using partial object matching because timestamp might have precision differences
    expect(logData.workLog[0]).toMatchObject(logEntry);
  });
});
