import {type ResultPromise} from "execa";
import {import_meta_ponyfill} from "import-meta-ponyfill";
import assert from "node:assert";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {afterEach, beforeEach, describe, expect, it} from "vitest";
import {getJunDir, readMeta, updateMeta} from "../state.js";
import type {JunTask} from "../types.js";
import {junKillLogic} from "./kill.js";
import {junStartLogic} from "./start.js";

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Helper to wait for a task to appear in the running list with an osPid
async function waitForTaskRunning(pid: number, timeout = 3000): Promise<JunTask> {
  const start = Date.now();
  const junDir = await getJunDir();
  while (Date.now() - start < timeout) {
    const tasks = await readMeta(junDir);
    const task = tasks.get(pid);
    if (task && task.status === "running" && typeof task.osPid === "number") {
      return task;
    }
    await sleep(100);
  }
  throw new Error(`Task with pid ${pid} did not appear as running with an osPid within ${timeout}ms`);
}

describe("junKillLogic", () => {
  let testDir: string;
  let originalCwd: string;
  let backgroundProcesses: ResultPromise[] = [];
  let cliPath: string;

  beforeEach(async (t) => {
    originalCwd = process.cwd();
    testDir = await fsp.mkdtemp(path.join(os.tmpdir(), `jun_kill_logic_test_${t.task.id}_`));
    await fsp.mkdir(path.resolve(testDir, ".jun"));
    process.chdir(testDir);
    backgroundProcesses = [];
    cliPath = fileURLToPath(await import_meta_ponyfill(import.meta).resolve("#cli"));
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await Promise.allSettled(
      backgroundProcesses.map((p) => {
        if (p.pid && !p.killed) {
          try {
            process.kill(p.pid, "SIGKILL");
          } catch {}
        }
        return p.catch((e) => {
          if (!e.isTerminated) throw e;
        });
      }),
    );
    await fsp.rm(testDir, {recursive: true, force: true});
  });

  it("should kill a running process and update its status", async () => {
    junStartLogic({
      command: "sleep",
      commandArgs: ["10"],
    });

    await waitForTaskRunning(1); // Wait for task pid 1 to be running with an osPid

    const {killedCount, failedPids} = await junKillLogic({pids: [1]});
    expect(killedCount).toBe(1);
    expect(failedPids.length, failedPids[0]?.reason).toBe(0);

    let killedTask: JunTask | undefined;
    await updateMeta(await getJunDir(), (tasks) => {
      killedTask = tasks.get(1);
    });
    assert.ok(killedTask);
    expect(killedTask.status).toBe("killed");
    expect(killedTask.endTime).toBeDefined();
    expect(killedTask.osPid).toBeUndefined();
  });

  it("should report a failure when trying to kill a non-running process", async () => {
    const junDir = await getJunDir();
    await updateMeta(junDir, (tasks) => {
      const completedTask: JunTask = {pid: 1, command: "echo", args: [], startTime: "t", status: "completed", mode: "tty", output: "raw"};
      tasks.set(1, completedTask);
    });

    const {killedCount, failedPids} = await junKillLogic({pids: [1]});
    expect(killedCount).toBe(0);
    assert.ok(failedPids.at(0));
    expect(failedPids.at(0)?.reason).toBe("Task is not running or has no OS PID.");
  });

  it("should handle killing all running processes", async () => {
    junStartLogic({
      command: "sleep",
      commandArgs: ["10"],
    });
    junStartLogic({
      command: "sleep",
      commandArgs: ["10"],
    });

    await waitForTaskRunning(1);
    await waitForTaskRunning(2);

    const junDir = await getJunDir();
    await updateMeta(junDir, (tasks) => {
      tasks.set(3, {pid: 3, command: "echo", args: [], startTime: "t", status: "completed", mode: "tty", output: "raw"});
    });

    const {killedCount} = await junKillLogic({all: true});
    expect(killedCount).toBe(2);

    let updatedTasks: Map<number, JunTask> = new Map();
    await updateMeta(junDir, (tasks) => {
      updatedTasks = tasks;
    });
    expect(updatedTasks.get(1)?.status).toBe("killed");
    expect(updatedTasks.get(2)?.status).toBe("killed");
    expect(updatedTasks.get(3)?.status).toBe("completed");
  });
});
