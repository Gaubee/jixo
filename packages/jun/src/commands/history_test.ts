import {assertEquals} from "@std/assert";
import {resolve} from "@std/path";
import {afterEach, beforeEach, describe, it} from "@std/testing/bdd";
import {getJunDir, overwriteMeta} from "../state.ts";
import type {JunTask} from "../types.ts";
import {junHistoryLogic} from "./history.ts";

describe("junHistoryLogic", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await Deno.makeTempDir({prefix: "jun_history_logic_test_"});
    await Deno.mkdir(resolve(testDir, ".jun"));
    Deno.chdir(testDir);
  });

  afterEach(async () => {
    Deno.chdir("..");
    await Deno.remove(testDir, {recursive: true});
  });

  it("should return all tasks sorted by pid descending", async () => {
    const junDir = await getJunDir();
    const tasks = new Map<number, JunTask>();
    tasks.set(1, {pid: 1, command: "sleep", args: ["10"], startTime: "t1", status: "running"});
    tasks.set(2, {pid: 2, command: "echo", args: [], startTime: "t2", status: "completed"});
    tasks.set(3, {pid: 3, command: "deno", args: [], startTime: "t3", status: "killed"});
    await overwriteMeta(junDir, tasks);

    const allTasks = await junHistoryLogic();
    assertEquals(allTasks.length, 3);
    assertEquals(
      allTasks.map((t) => t.pid),
      [3, 2, 1],
    );
  });

  it("should return an empty array when there are no tasks", async () => {
    const allTasks = await junHistoryLogic();
    assertEquals(allTasks.length, 0);
  });
});

// JIXO_CODER_EOF
