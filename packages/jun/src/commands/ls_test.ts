import {assertEquals} from "@std/assert";
import {resolve} from "@std/path";
import {afterEach, beforeEach, describe, it} from "@std/testing/bdd";
import {getJunDir, overwriteMeta} from "../state.ts";
import type {JunTask} from "../types.ts";
import {junLsLogic} from "./ls.ts";

describe("junLsLogic", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await Deno.makeTempDir({prefix: "jun_ls_logic_test_"});
    await Deno.mkdir(resolve(testDir, ".jun"));
    Deno.chdir(testDir);
  });

  afterEach(async () => {
    Deno.chdir("..");
    await Deno.remove(testDir, {recursive: true});
  });

  it("should return only running tasks", async () => {
    const junDir = await getJunDir();
    const tasks = new Map<number, JunTask>();
    tasks.set(1, {pid: 1, command: "sleep", args: ["10"], startTime: "t1", status: "running"});
    tasks.set(2, {pid: 2, command: "echo", args: [], startTime: "t2", status: "completed"});
    tasks.set(3, {pid: 3, command: "deno", args: [], startTime: "t3", status: "killed"});
    tasks.set(4, {pid: 4, command: "false", args: [], startTime: "t4", status: "error"});
    tasks.set(5, {pid: 5, command: "cat", args: [], startTime: "t5", status: "running"});
    await overwriteMeta(junDir, tasks);

    const runningTasks = await junLsLogic();
    assertEquals(runningTasks.length, 2);
    assertEquals(runningTasks.map((t) => t.pid).sort(), [1, 5]);
  });

  it("should return an empty array when no tasks are running", async () => {
    const junDir = await getJunDir();
    const tasks = new Map<number, JunTask>();
    tasks.set(1, {pid: 1, command: "echo", args: [], startTime: "t2", status: "completed"});
    await overwriteMeta(junDir, tasks);

    const runningTasks = await junLsLogic();
    assertEquals(runningTasks.length, 0);
  });

  it("should return an empty array when there are no tasks", async () => {
    const runningTasks = await junLsLogic();
    assertEquals(runningTasks.length, 0);
  });
});

// JIXO_CODER_EOF
