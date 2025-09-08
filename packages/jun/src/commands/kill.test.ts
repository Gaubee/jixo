import {execaNode, type ResultPromise} from "execa";
import {import_meta_ponyfill} from "import-meta-ponyfill";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {afterEach, beforeEach, describe, expect, it} from "vitest";
import {getJunDir, updateMeta} from "../state.js";
import type {JunTask} from "../types.js";
import {junKillLogic} from "./kill.js";
import {junLsLogic} from "./ls.js";

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Helper to wait for a task to appear in the running list
async function waitForTaskRunning(pid: number, timeout = 2000): Promise<JunTask> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const runningTasks = await junLsLogic();
    // console.log(`Waiting for PID ${pid}, current running:`, runningTasks.map(t => t.pid));
    const task = runningTasks.find((t) => t.pid === pid && t.status === "running" && t.osPid !== undefined);
    if (task) {
      return task;
    }
    await sleep(100); // Increased sleep time slightly
  }
  throw new Error(`Task with pid ${pid} did not appear as running within ${timeout}ms`);
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

    let retry = 3;
    while (retry > 0) {
      try {
        await fsp.rm(testDir, {recursive: true, force: true});
        break;
      } catch (e) {
        retry--;
        await sleep(200);
        if (retry <= 0) {
          throw e;
        }
      }
    }
    // Clean up any tracked background processes
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
  });

  it("should kill a running process and update its status", async () => {
    const fakeProcess = execaNode(cliPath, ["start", "sleep", "10"], {detached: true, stdio: "ignore"});
    backgroundProcesses.push(fakeProcess);
    fakeProcess.unref();

    const runningTask = await waitForTaskRunning(1); // Wait for task pid 1 to be running
    expect(runningTask).toBeDefined();

    const {killedCount, failedPids} = await junKillLogic({pids: [1]});
    expect(killedCount).toBe(1);
    expect(Object.keys(failedPids).length).toBe(0);

    let killedTask: JunTask | undefined;
    await updateMeta(await getJunDir(), (tasks) => {
      killedTask = tasks.get(1);
    });
    expect(killedTask).toBeDefined();
    expect(killedTask?.status).toBe("killed");
    expect(killedTask?.endTime).toBeDefined();
    expect(killedTask?.osPid).toBeUndefined();
  });

  it("should report a failure when trying to kill a non-running process", async () => {
    const junDir = await getJunDir();
    await updateMeta(junDir, (tasks) => {
      const completedTask: JunTask = {pid: 1, command: "echo", args: [], startTime: "t", status: "completed", mode: "tty", output: "raw"};
      tasks.set(1, completedTask);
    });

    const {killedCount, failedPids} = await junKillLogic({pids: [1]});
    expect(killedCount).toBe(0);
    expect(failedPids[1]).toBeDefined();
    expect(failedPids[1]).toBe("Task is not running or has no OS PID.");
  });

  it("should handle killing all running processes", async () => {
    const p1 = execaNode(cliPath, ["start", "sleep", "10"], {detached: true, stdio: "ignore"});
    backgroundProcesses.push(p1);
    p1.unref();
    const p2 = execaNode(cliPath, ["start", "sleep", "10"], {detached: true, stdio: "ignore"});
    backgroundProcesses.push(p2);
    p2.unref();

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
