import {assertEquals, assertExists} from "@std/assert";
import {resolve} from "@std/path";
import {afterEach, beforeEach, describe, it} from "@std/testing/bdd";
import {getJunDir, overwriteMeta, writeLog} from "../state.ts";
import type {JunTask} from "../types.ts";
import {junCatLogic} from "./cat.ts";

describe("junCatLogic", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await Deno.makeTempDir({prefix: "jun_cat_logic_test_"});
    await Deno.mkdir(resolve(testDir, ".jun"));
    Deno.chdir(testDir);
  });

  afterEach(async () => {
    Deno.chdir("..");
    await Deno.remove(testDir, {recursive: true});
  });

  it("should return task details and stdio in a success record", async () => {
    const junDir = await getJunDir();
    const tasks = new Map<number, JunTask>();
    tasks.set(1, {pid: 1, command: "echo", args: ["hi"], startTime: "t1", status: "completed"});
    await overwriteMeta(junDir, tasks);
    await writeLog(junDir, 1, {type: "stdout", content: "hi\n", time: "t2"});

    const {success, failed} = await junCatLogic([1]);
    assertEquals(Object.keys(failed).length, 0);
    assertExists(success[1]);

    const taskLog = success[1];
    assertEquals(taskLog.pid, 1);
    assertEquals(taskLog.command, "echo");
    assertEquals(taskLog.stdio.length, 1);
    assertEquals(taskLog.stdio[0]?.content, "hi\n");
  });

  it("should handle multiple pids and report not found pids in a failed record", async () => {
    const junDir = await getJunDir();
    const tasks = new Map<number, JunTask>();
    tasks.set(1, {pid: 1, command: "echo", args: ["hi"], startTime: "t1", status: "completed"});
    await overwriteMeta(junDir, tasks);

    const {success, failed} = await junCatLogic([1, 99]);
    assertExists(success[1]);
    assertExists(failed[99]);
    assertEquals(failed[99], "Task not found.");
  });
});

// JIXO_CODER_EOF
