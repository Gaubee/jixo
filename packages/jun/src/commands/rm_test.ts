import {assertEquals, assertExists} from "@std/assert";
import {resolve} from "@std/path";
import {afterEach, beforeEach, describe, it} from "@std/testing/bdd";
import {getJunDir, overwriteMeta, readMeta, writeLog} from "../state.ts";
import type {JunTask} from "../types.ts";
import {junRmLogic} from "./rm.ts";

describe("junRmLogic", () => {
  let testDir: string;
  let junDir: string;

  beforeEach(async () => {
    testDir = await Deno.makeTempDir({prefix: "jun_rm_logic_test_"});
    await Deno.mkdir(resolve(testDir, ".jun"));
    Deno.chdir(testDir);
    junDir = await getJunDir();

    const tasks = new Map<number, JunTask>();
    tasks.set(1, {pid: 1, command: "c1", args: [], startTime: "t1", status: "completed"});
    tasks.set(2, {pid: 2, command: "c2", args: [], startTime: "t2", status: "error"});
    tasks.set(3, {pid: 3, command: "c3", args: [], startTime: "t3", status: "running"});
    tasks.set(4, {pid: 4, command: "c4", args: [], startTime: "t4", status: "killed"});
    await overwriteMeta(junDir, tasks);
    await writeLog(junDir, 1, {type: "stdout", content: "log1", time: "t"});
    await writeLog(junDir, 2, {type: "stdout", content: "log2", time: "t"});
  });

  afterEach(async () => {
    Deno.chdir("..");
    await Deno.remove(testDir, {recursive: true});
  });

  it("should remove specified pids and skip running ones", async () => {
    const {removed, skipped} = await junRmLogic({pids: [1, 2, 3]});
    assertEquals(removed.sort(), [1, 2]);
    assertExists(skipped[3]);

    const tasks = await readMeta(junDir);
    assertEquals(tasks.size, 2); // 3 (running) and 4 (killed, but not in pids)
    assertEquals(tasks.has(1), false);
    assertEquals(tasks.has(2), false);
    assertEquals(tasks.has(3), true);
  });

  it("should remove all but running tasks with --all", async () => {
    const {removed} = await junRmLogic({all: true});
    assertEquals(removed.sort(), [1, 2, 4]);

    const tasks = await readMeta(junDir);
    assertEquals(tasks.size, 1);
    assertEquals(tasks.get(3)?.status, "running");
  });

  it("should keep recent and running tasks with --auto", async () => {
    const tasks = await readMeta(junDir);
    for (let i = 5; i <= 12; i++) {
      tasks.set(i, {pid: i, command: `c${i}`, args: [], startTime: `t${i}`, status: "completed"});
    }
    await overwriteMeta(junDir, tasks);

    const {removed} = await junRmLogic({auto: true});
    assertEquals(removed.sort(), [1, 2]);

    const remainingTasks = await readMeta(junDir);
    assertEquals(remainingTasks.size, 10);
    assertEquals(remainingTasks.has(1), false);
    assertEquals(remainingTasks.has(2), false);
  });
});

// JIXO_CODER_EOF
