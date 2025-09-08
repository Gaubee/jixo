import {junHistoryLogic, junInitLogic, junLsLogic} from "@jixo/jun";
import {assert, assertEquals} from "jsr:@std/assert";
import {afterEach, beforeEach, describe, it} from "jsr:@std/testing/bdd";
import {functionCall, paramsSchema} from "../coder/shellRun.js";

describe("shellRun tool", () => {
  let testDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    testDir = await Deno.makeTempDir({prefix: "shell_run_test_"});
    originalCwd = Deno.cwd();
    Deno.chdir(testDir);
    await junInitLogic();
  });

  afterEach(async () => {
    Deno.chdir(originalCwd);
    await Deno.remove(testDir, {recursive: true});
  });

  it("should run a foreground command and wait for completion", async () => {
    const args = {
      command: "echo",
      args: ["hello"],
      background: false,
    };
    paramsSchema.parse(args);
    const result = await functionCall(args);

    assertEquals(result.status, "COMPLETED");
    assertEquals(result.exit_code, 0);

    const history = await junHistoryLogic();
    assertEquals(history.length, 1);
    assertEquals(history[0]?.command, "echo");
    assertEquals(history[0]?.status, "completed");
  });

  it("should run a background command and immediately return the correct PID", async () => {
    const args = {
      command: "sleep",
      args: ["10"],
      background: true,
    };
    paramsSchema.parse(args);
    const result = await functionCall(args);

    assertEquals(result.status, "STARTED_IN_BACKGROUND");
    assert(result.pid > 0, "PID should be a positive number");
    assert(result.osPid > 0, "OS PID should be a positive number");

    // Verify the task is actually running
    const runningTasks = await junLsLogic();
    assertEquals(runningTasks.length, 1);
    assertEquals(runningTasks[0]?.pid, result.pid);
    assertEquals(runningTasks[0]?.status, "running");

    // Cleanup
    const bgProcess = Deno.run({cmd: ["kill", String(result.osPid)]});
    await bgProcess.status();
    bgProcess.close();
  });
});
