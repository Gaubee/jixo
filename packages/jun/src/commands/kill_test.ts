import {assertEquals, assertExists} from "@std/assert";
import {resolve} from "@std/path";
import {afterEach, beforeEach, describe, it} from "@std/testing/bdd";
import {getJunDir, overwriteMeta, readMeta} from "../state.ts";
import type {JunTask} from "../types.ts";
import {junKillLogic} from "./kill.ts";

describe("junKillLogic", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await Deno.makeTempDir({prefix: "jun_kill_logic_test_"});
    await Deno.mkdir(resolve(testDir, ".jun"));
    Deno.chdir(testDir);
  });

  afterEach(async () => {
    Deno.chdir("..");
    await Deno.remove(testDir, {recursive: true});
  });

  it("should kill a running process and update its status", async () => {
    const junDir = await getJunDir();
    const tasks = new Map<number, JunTask>();
    const fakeProcess = new Deno.Command("sleep", {args: ["10"]}).spawn();

    const runningTask: JunTask = {
      pid: 1,
      osPid: fakeProcess.pid,
      command: "sleep",
      args: ["10"],
      startTime: new Date().toISOString(),
      status: "running",
    };
    tasks.set(1, runningTask);
    await overwriteMeta(junDir, tasks);

    const {killedCount, failedPids} = await junKillLogic({pids: [1]});
    assertEquals(killedCount, 1);
    assertEquals(Object.keys(failedPids).length, 0);

    const updatedTasks = await readMeta(junDir);
    const killedTask = updatedTasks.get(1);
    assertExists(killedTask);
    assertEquals(killedTask.status, "killed");
    assertExists(killedTask.endTime);
    assertEquals(killedTask.osPid, undefined);

    try {
      fakeProcess.kill();
    } catch {}
    await fakeProcess.status;
  });

  it("should report a failure when trying to kill a non-running process", async () => {
    const junDir = await getJunDir();
    const tasks = new Map<number, JunTask>();
    const completedTask: JunTask = {pid: 1, command: "echo", args: [], startTime: "t", status: "completed"};
    tasks.set(1, completedTask);
    await overwriteMeta(junDir, tasks);

    const {killedCount, failedPids} = await junKillLogic({pids: [1]});
    assertEquals(killedCount, 0);
    assertExists(failedPids[1]);
    assertEquals(failedPids[1], "Task is not running or has no OS PID.");
  });

  it("should handle killing all running processes", async () => {
    const junDir = await getJunDir();
    const tasks = new Map<number, JunTask>();
    const p1 = new Deno.Command("sleep", {args: ["10"]}).spawn();
    const p2 = new Deno.Command("sleep", {args: ["10"]}).spawn();
    tasks.set(1, {pid: 1, osPid: p1.pid, command: "sleep", args: ["10"], startTime: "t", status: "running"});
    tasks.set(2, {pid: 2, command: "echo", args: [], startTime: "t", status: "completed"});
    tasks.set(3, {pid: 3, osPid: p2.pid, command: "sleep", args: ["10"], startTime: "t", status: "running"});
    await overwriteMeta(junDir, tasks);

    const {killedCount} = await junKillLogic({all: true});
    assertEquals(killedCount, 2);

    const updatedTasks = await readMeta(junDir);
    assertEquals(updatedTasks.get(1)?.status, "killed");
    assertEquals(updatedTasks.get(2)?.status, "completed");
    assertEquals(updatedTasks.get(3)?.status, "killed");

    try {
      p1.kill();
    } catch {}
    try {
      p2.kill();
    } catch {}
    await p1.status;
    await p2.status;
  });
});

// JIXO_CODER_EOF
