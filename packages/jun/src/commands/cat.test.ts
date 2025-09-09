import assert from "node:assert";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {afterEach, beforeEach, describe, expect, it} from "vitest";
import {getJunDir, updateMeta, writeLog} from "../state.js";
import {junCatLogic} from "./cat.js";

describe("junCatLogic", () => {
  let testDir: string;
  let originalCwd: string;

  beforeEach(async (t) => {
    originalCwd = process.cwd();
    testDir = await fsp.mkdtemp(path.join(os.tmpdir(), `jun_cat_logic_test_${t.task.id}_`));
    await fsp.mkdir(path.resolve(testDir, ".jun"));
    process.chdir(testDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await fsp.rm(testDir, {recursive: true, force: true});
  });

  it("should return task details and stdio in a success record", async () => {
    const junDir = await getJunDir();
    await updateMeta(junDir, (tasks) => {
      tasks.set(1, {pid: 1, command: "echo", args: ["hi"], startTime: "t1", status: "completed", mode: "tty", output: "text"});
    });
    await writeLog(junDir, 1, {type: "stdout", content: "hi\n", time: "t2"});

    const {success, failed} = await junCatLogic([1]);
    expect(Object.keys(failed).length).toBe(0);

    const taskLog = success.find((p) => p.pid === 1);
    assert.ok(taskLog);
    expect(taskLog.pid).toBe(1);
    expect(taskLog.command).toBe("echo");
    expect(taskLog.stdio.length).toBe(1);
    expect(taskLog.stdio[0]?.content).toBe("hi\n");
  });

  it("should handle multiple pids and report not found pids in a failed record", async () => {
    const junDir = await getJunDir();
    await updateMeta(junDir, (tasks) => {
      tasks.set(1, {pid: 1, command: "echo", args: ["hi"], startTime: "t1", status: "completed", mode: "tty", output: "text"});
    });

    const {success, failed} = await junCatLogic([1, 99]);
    assert.ok(success.find((p) => p.pid == 1));
    assert.ok(failed.find((p) => p.pid == 99));
    expect(failed.find((p) => p.pid == 99)?.reason).toBe("Task not found.");
  });
});
