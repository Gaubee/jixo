import {assert, assertEquals} from "jsr:@std/assert";
import {afterEach, beforeEach, describe, it} from "jsr:@std/testing/bdd";
import {junHistoryLogic, junInitLogic} from "jsr:@jixo/jun";
import {functionCall, paramsSchema} from "./shellRun.ts";

describe("shellRun tool", () => {
  let testDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    testDir = await Deno.makeTempDir({prefix: "shell_run_test_"});
    originalCwd = Deno.cwd();
    Deno.chdir(testDir);
    await junInitLogic(); // Initialize a local .jun for the test
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

    // Verify it was actually logged in history
    const history = await junHistoryLogic();
    assertEquals(history.length, 1);
    assertEquals(history[0]?.command, "echo");
    assertEquals(history[0]?.status, "completed");
  });

  // Background testing is complex as it creates detached processes.
  // We'll test that it returns the correct status, but won't verify the process itself in this unit test.
  it("should return background status for a background command", async () => {
    const args = {
      command: "sleep",
      args: ["0.1"],
      background: true,
    };
    paramsSchema.parse(args);
    const result = await functionCall(args);

    assertEquals(result.status, "STARTED_IN_BACKGROUND");
    assert(typeof result.message === "string");

    // Give a moment for the background process to potentially start and finish
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Even after a delay, history should show the task as it's logged upon start.
    const history = await junHistoryLogic();
    assert(history.length >= 1, "Background task should appear in history");
  });
});

// JIXO_CODER_EOF
