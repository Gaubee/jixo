import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {afterEach, beforeEach, describe, expect, it} from "vitest";
import {getJunDir, readMeta, updateMeta, writeLog} from "../state.js";
import {junRmLogic} from "./rm.js";

describe("junRmLogic", () => {
  let testDir: string;
  let junDir: string;
  let originalCwd: string;

  beforeEach(async (t) => {
    originalCwd = process.cwd();
    testDir = await fsp.mkdtemp(path.join(os.tmpdir(), `jun_rm_logic_test_${t.task.id}_`));
    await fsp.mkdir(path.resolve(testDir, ".jun"));
    process.chdir(testDir);
    junDir = await getJunDir();

    await updateMeta(junDir, (tasks) => {
      tasks.set(1, {pid: 1, command: "c1", args: [], startTime: "t1", status: "completed", mode: "tty", output: "raw"});
      tasks.set(2, {pid: 2, command: "c2", args: [], startTime: "t2", status: "error", mode: "tty", output: "raw"});
      tasks.set(3, {pid: 3, command: "c3", args: [], startTime: "t3", status: "running", mode: "tty", output: "raw"});
      tasks.set(4, {pid: 4, command: "c4", args: [], startTime: "t4", status: "killed", mode: "tty", output: "raw"});
    });
    await writeLog(junDir, 1, {type: "stdout", content: "log1", time: "t"});
    await writeLog(junDir, 2, {type: "stdout", content: "log2", time: "t"});
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await fsp.rm(testDir, {recursive: true, force: true});
  });

  it("should remove specified pids and skip running ones", async () => {
    const {removed, skipped} = await junRmLogic({pids: [1, 2, 3]});
    expect(removed.sort()).toEqual([1, 2]);
    expect(skipped[3]).toBeDefined();

    const tasks = await readMeta(junDir);
    expect(tasks.size).toBe(2); // 3 (running) and 4 (killed, but not in pids)
    expect(tasks.has(1)).toBe(false);
    expect(tasks.has(2)).toBe(false);
    expect(tasks.has(3)).toBe(true);
  });

  it("should remove all but running tasks with --all", async () => {
    const {removed} = await junRmLogic({all: true});
    expect(removed.sort()).toEqual([1, 2, 4]);

    const tasks = await readMeta(junDir);
    expect(tasks.size).toBe(1);
    expect(tasks.get(3)?.status).toBe("running");
  });

  it("should keep recent and running tasks with --auto", async () => {
    await updateMeta(junDir, (tasks) => {
      for (let i = 5; i <= 12; i++) {
        tasks.set(i, {pid: i, command: `c${i}`, args: [], startTime: `t${i}`, status: "completed", mode: "tty", output: "raw"});
      }
    });

    const {removed} = await junRmLogic({auto: true});
    expect(removed.sort()).toEqual([1, 2]);

    const remainingTasks = await readMeta(junDir);
    expect(remainingTasks.size).toBe(10);
    expect(remainingTasks.has(1)).toBe(false);
    expect(remainingTasks.has(2)).toBe(false);
  });
});
