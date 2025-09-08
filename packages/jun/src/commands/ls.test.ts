import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {afterEach, beforeEach, describe, expect, it} from "vitest";
import {getJunDir, updateMeta} from "../state.js";
import {junLsLogic} from "./ls.js";

describe("junLsLogic", () => {
  let testDir: string;
  let originalCwd: string;

  beforeEach(async (t) => {
    originalCwd = process.cwd();
    testDir = await fsp.mkdtemp(path.join(os.tmpdir(), `jun_ls_logic_test_${t.task.id}_`));
    await fsp.mkdir(path.resolve(testDir, ".jun"));
    process.chdir(testDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await fsp.rm(testDir, {recursive: true, force: true});
  });

  it("should return only running tasks", async () => {
    const junDir = await getJunDir();
    await updateMeta(junDir, (tasks) => {
      tasks.set(1, {pid: 1, command: "sleep", args: ["10"], startTime: "t1", status: "running", mode: "tty", output: "raw"});
      tasks.set(2, {pid: 2, command: "echo", args: [], startTime: "t2", status: "completed", mode: "tty", output: "raw"});
      tasks.set(3, {pid: 3, command: "deno", args: [], startTime: "t3", status: "killed", mode: "tty", output: "raw"});
      tasks.set(4, {pid: 4, command: "false", args: [], startTime: "t4", status: "error", mode: "tty", output: "raw"});
      tasks.set(5, {pid: 5, command: "cat", args: [], startTime: "t5", status: "running", mode: "tty", output: "raw"});
    });

    const runningTasks = await junLsLogic();
    expect(runningTasks.length).toBe(2);
    expect(runningTasks.map((t) => t.pid).sort()).toEqual([1, 5]);
  });

  it("should return an empty array when no tasks are running", async () => {
    const junDir = await getJunDir();
    await updateMeta(junDir, (tasks) => {
      tasks.set(1, {pid: 1, command: "echo", args: [], startTime: "t2", status: "completed", mode: "tty", output: "raw"});
    });

    const runningTasks = await junLsLogic();
    expect(runningTasks.length).toBe(0);
  });

  it("should return an empty array when there are no tasks", async () => {
    const runningTasks = await junLsLogic();
    expect(runningTasks.length).toBe(0);
  });
});
