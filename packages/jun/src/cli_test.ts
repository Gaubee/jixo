import {assertEquals, assertStringIncludes} from "@std/assert";
import {afterEach, beforeEach, describe, it} from "@std/testing/bdd";
import {main} from "./cli.ts";
import {junHistoryLogic} from "./commands/history.ts";

describe("jun CLI In-Process E2E", () => {
  let testDir: string;
  let originalCwd: string;
  let originalConsoleLog: (...args: any[]) => void;
  let originalConsoleError: (...args: any[]) => void;
  let stdout: string;
  let stderr: string;

  beforeEach(async () => {
    testDir = await Deno.makeTempDir({prefix: "jun_in_process_test_"});
    originalCwd = Deno.cwd();
    Deno.chdir(testDir);

    // Hijack console
    stdout = "";
    stderr = "";
    originalConsoleLog = console.log;
    originalConsoleError = console.error;
    console.log = (...args: any[]) => {
      stdout += args.join(" ") + "\n";
    };
    console.error = (...args: any[]) => {
      stderr += args.join(" ") + "\n";
    };

    await invokeJun("init");
  });

  afterEach(async () => {
    // Restore console
    console.log = originalConsoleLog;
    console.error = originalConsoleError;

    Deno.chdir(originalCwd);
    await Deno.remove(testDir, {recursive: true});
  });

  // --- Helper to invoke the main function ---
  async function invokeJun(...args: string[]) {
    // Reset outputs for each invocation
    stdout = "";
    stderr = "";
    const code = await main(args);
    return {code, stdout, stderr};
  }

  // --- Test Cases ---
  it("should support default 'run' command", async () => {
    const runResult = await invokeJun("echo", "hello from default run");
    assertEquals(runResult.code, 0);
    assertStringIncludes(runResult.stdout, "hello from default run");

    const historyResult = await invokeJun("history", "--json");
    const tasks = JSON.parse(historyResult.stdout);
    assertEquals(tasks.length, 1);
    assertEquals(tasks[0].command, "echo");
    assertEquals(tasks[0].status, "completed");
  });

  it("should cat the stdio of the correct command", async () => {
    await invokeJun("run", "echo", "first command");
    await invokeJun("run", "sh", "-c", 'echo "out test" && echo "err test" >&2');

    // Use the programmatic API to get the history reliably
    const history = await junHistoryLogic();
    const taskToCat = history.find((t) => t.command === "sh");
    assertEquals(taskToCat !== undefined, true, "Could not find the 'sh' command in history");

    const catResult = await invokeJun("cat", String(taskToCat!.pid));
    assertStringIncludes(catResult.stdout, `--- Log for PID ${taskToCat!.pid}: sh -c echo "out test" && echo "err test" >&2 ---`);
    assertStringIncludes(catResult.stdout, "[stdout] out test");
    assertStringIncludes(catResult.stdout, "[stderr] err test");
  });

  it("should run a simple command, show it in history, and then remove it", async () => {
    await invokeJun("run", "echo", "hello world");

    const historyResult = await invokeJun("history", "--json");
    let tasks = JSON.parse(historyResult.stdout);
    const taskPid = tasks[0].pid;

    await invokeJun("rm", String(taskPid));

    const historyAfterRm = await invokeJun("history", "--json");
    tasks = JSON.parse(historyAfterRm.stdout);
    assertEquals(tasks.length, 0);
  });
});
