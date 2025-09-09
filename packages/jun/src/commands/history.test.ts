import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {afterEach, beforeEach, describe, expect, it} from "vitest";
import {getJunDir, updateMeta} from "../state.js";
import {junHistoryLogic} from "./history.js";

describe("junHistoryLogic", () => {
  let testDir: string;
  let originalCwd: string;

  beforeEach(async (t) => {
    originalCwd = process.cwd();
    testDir = await fsp.mkdtemp(path.join(os.tmpdir(), `jun_history_logic_test_${t.task.id}_`));
    await fsp.mkdir(path.resolve(testDir, ".jun"));
    process.chdir(testDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await fsp.rm(testDir, {recursive: true, force: true});
  });

  it("should return all tasks sorted by pid descending", async () => {
    const junDir = await getJunDir();
    await updateMeta(junDir, (tasks) => {
      tasks.set(1, {pid: 1, command: "sleep", args: ["10"], startTime: "t1", status: "running", mode: "tty", output: "raw"});
      tasks.set(2, {pid: 2, command: "echo", args: [], startTime: "t2", status: "completed", mode: "tty", output: "raw"});
      tasks.set(3, {pid: 3, command: "deno", args: [], startTime: "t3", status: "killed", mode: "tty", output: "raw"});
    });

    const allTasks = await junHistoryLogic();
    expect(allTasks.length).toBe(3);
    expect(allTasks.map((t) => t.pid)).toEqual([1, 2, 3]);
  });

  it("should return an empty array when there are no tasks", async () => {
    const allTasks = await junHistoryLogic();
    expect(allTasks.length).toBe(0);
  });
});
