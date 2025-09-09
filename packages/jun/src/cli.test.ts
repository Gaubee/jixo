import assert from "node:assert";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {main} from "./cli.js";
import {junHistoryLogic} from "./commands/history.js";

describe("jun CLI In-Process E2E", () => {
  let testDir: string;
  let originalCwd: string;

  beforeEach(async (t) => {
    originalCwd = process.cwd();
    testDir = await fsp.mkdtemp(path.join(os.tmpdir(), `jun_cli_test_${t.task.id}_`));
    process.chdir(testDir);
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    await invokeJun("init");
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    process.chdir(originalCwd);
    await fsp.rm(testDir, {recursive: true, force: true});
  });

  // --- Helper to invoke the main function ---
  async function invokeJun(...args: string[]) {
    const code = await main(args);
    const stdout = (console.log as any).mock.calls.map((call: any[]) => call.join(" ")).join("\n");
    const stderr = (console.error as any).mock.calls.map((call: any[]) => call.join(" ")).join("\n");
    (console.log as any).mockClear();
    (console.error as any).mockClear();
    return {code, stdout, stderr};
  }

  // --- Test Cases ---
  it("should support default 'run' command", async () => {
    const runResult = await invokeJun("echo", "hello from default run");
    expect(runResult.code).toBe(0);

    const historyResult = await invokeJun("history", "--json");
    const tasks = JSON.parse(historyResult.stdout);
    expect(tasks.length).toBe(1);
    expect(tasks[0].command).toBe("echo");
    expect(tasks[0].status).toBe("completed");
  });

  it("should cat the stdio of the correct command", async () => {
    await invokeJun("run", "echo", "first command");

    const shellCommand = process.platform === "win32" ? "cmd.exe" : "sh";
    const shellArgs = process.platform === "win32" ? ["/c", 'echo "out test" & echo "err test" >&2'] : ["-c", 'echo "out test" && echo "err test" >&2'];
    await invokeJun("run", "--mode", "cp", "--", shellCommand, ...shellArgs);

    // Use the programmatic API to get the history reliably
    const history = await junHistoryLogic();
    const taskToCat = history.find((t) => t.command === "sh" || t.command === "cmd.exe");
    assert.ok(taskToCat);

    const catResult = await invokeJun("cat", String(taskToCat.pid));
    const expectedCommandStr = [shellCommand, ...shellArgs].join(" ");
    expect(catResult.stdout).toContain(`--- Log for PID ${taskToCat!.pid}: ${expectedCommandStr} ---`);
    expect(catResult.stdout).toContain("[stdout] out test");
    expect(catResult.stdout).toContain("[stderr] err test");
  });

  it("should run a simple command, show it in history, and then remove it", async () => {
    await invokeJun("run", "echo", "hello world");

    const historyResult = await invokeJun("history", "--json");
    let tasks = JSON.parse(historyResult.stdout);
    const taskPid = tasks[0].pid;

    await invokeJun("rm", String(taskPid));

    const historyAfterRm = await invokeJun("history", "--json");
    tasks = JSON.parse(historyAfterRm.stdout);
    expect(tasks.length).toBe(0);
  });
});
