import {assertEquals, assertExists} from "@std/assert";
import {resolve} from "@std/path";
import {afterEach, beforeEach, describe, it} from "@std/testing/bdd";
import {getJunDir, readMeta} from "../state.ts";
import {junRunLogic} from "./run.ts";

describe("junRunLogic", () => {
  let testDir: string;
  let originalConsoleLog: typeof console.log;
  let stdout: string;

  beforeEach(async () => {
    testDir = await Deno.makeTempDir({prefix: "jun_run_logic_test_"});
    await Deno.mkdir(resolve(testDir, ".jun"));
    Deno.chdir(testDir);
    // Hijack console.log to capture --json output
    originalConsoleLog = console.log;
    stdout = "";
    console.log = (...args: any[]) => {
      stdout += args.join(" ") + "\n";
    };
  });

  afterEach(async () => {
    console.log = originalConsoleLog; // Restore console.log
    Deno.chdir("..");
    await Deno.remove(testDir, {recursive: true});
  });

  it("should run a simple command to completion", async () => {
    const exitCode = await junRunLogic({command: "echo", commandArgs: ["hello"], background: false, json: false});
    assertEquals(exitCode, 0);

    const junDir = await getJunDir();
    const tasks = await readMeta(junDir);
    assertEquals(tasks.size, 1);
    const task = tasks.get(1);
    assertExists(task);
    assertEquals(task.status, "completed");
  });

  it("should run a foreground command with --json output", async () => {
    await junRunLogic({command: "echo", commandArgs: ["hello"], background: false, json: true});

    const parsedOutput = JSON.parse(stdout);
    assertEquals(parsedOutput.status, "STARTED_IN_FOREGROUND");
    assertEquals(parsedOutput.pid, 1);
    assertExists(parsedOutput.osPid);
  });

  it("should run a background command and exit immediately", async () => {
    // This test is tricky because it spawns a detached process.
    // The main verification will be in the E2E test.
    // Here, we just verify the immediate output.
    const exitCode = await junRunLogic({command: "sleep", commandArgs: ["1"], background: true, json: true});
    assertEquals(exitCode, 0);

    const parsedOutput = JSON.parse(stdout);
    assertEquals(parsedOutput.status, "STARTED_IN_BACKGROUND");
    assertEquals(parsedOutput.pid, 1);
    assertExists(parsedOutput.osPid);

    // Allow a moment for the meta file to be written by the detached process, then clean up.
    await new Promise((r) => setTimeout(r, 100));
    try {
      Deno.kill(parsedOutput.osPid);
    } catch {
      /* might have already finished */
    }
  });
});
