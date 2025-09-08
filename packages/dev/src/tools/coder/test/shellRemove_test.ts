import {assertEquals, assertExists} from "jsr:@std/assert";
import {afterEach, beforeEach, describe, it} from "jsr:@std/testing/bdd";
import {junHistoryLogic, junInitLogic, junRunLogic} from "@jixo/jun";
import {functionCall} from "./shellRemove.js";

describe("shellRemove tool", () => {
  let testDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    testDir = await Deno.makeTempDir({prefix: "shell_remove_test_"});
    originalCwd = Deno.cwd();
    Deno.chdir(testDir);
    await junInitLogic();
  });

  afterEach(async () => {
    Deno.chdir(originalCwd);
    await Deno.remove(testDir, {recursive: true});
  });

  it("should remove a specific completed task by pid", async () => {
    await junRunLogic("echo", ["task1"]); // pid 1
    await junRunLogic("echo", ["task2"]); // pid 2

    const result = await functionCall({pids: [1]});

    assertEquals(result.status, "SUCCESS");
    assertEquals(result.removed_pids, [1]);
    assertEquals(Object.keys(result.skipped_pids).length, 0);

    const history = await junHistoryLogic();
    assertEquals(history.length, 1);
    assertEquals(history[0]?.pid, 2);
  });

  it("should skip removing a running task", async () => {
    const bgProcess = new Deno.Command(Deno.execPath(), {
      args: ["run", "-A", "jsr:@jixo/jun/cli", "run", "sleep", "1"],
      cwd: testDir,
    }).spawn();
    await new Promise((r) => setTimeout(r, 300)); // wait for it to be registered

    const historyBefore = await junHistoryLogic();
    const runningTask = historyBefore.find((t) => t.status === "running");
    assertExists(runningTask);

    const result = await functionCall({pids: [runningTask.pid]});

    assertEquals(result.status, "SUCCESS");
    assertEquals(result.removed_pids.length, 0);
    assertExists(result.skipped_pids[runningTask.pid]);

    // Cleanup
    try {
      bgProcess.kill();
    } catch {}
    await bgProcess.status;
  });

  it("should remove all finished tasks with --all", async () => {
    await junRunLogic("echo", ["task1"]); // completed
    await junRunLogic("false", []); // error
    const bgProcess = new Deno.Command(Deno.execPath(), {
      args: ["run", "-A", "jsr:@jixo/jun/cli", "run", "sleep", "1"],
      cwd: testDir,
    }).spawn();
    await new Promise((r) => setTimeout(r, 300)); // running

    const result = await functionCall({all: true});

    assertEquals(result.status, "SUCCESS");
    assertEquals(result.removed_pids.sort(), [1, 2]);

    const history = await junHistoryLogic();
    assertEquals(history.length, 1);
    assertEquals(history[0]?.status, "running");

    // Cleanup
    try {
      bgProcess.kill();
    } catch {}
    await bgProcess.status;
  });
});

// JIXO_CODER_EOF
