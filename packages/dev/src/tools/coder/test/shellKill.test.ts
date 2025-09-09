import {junHistoryLogic, junLsLogic, junStartLogic} from "@jixo/jun";
import assert from "node:assert";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {afterEach, beforeEach, describe, expect, it} from "vitest";
import {functionCall as shellKill} from "../shellKill.function_call.js";

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("shellKill tool", () => {
  let testDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    testDir = await fsp.mkdtemp(path.join(os.tmpdir(), "shell_kill_test_"));
    originalCwd = process.cwd();
    await fsp.mkdir(path.resolve(testDir, ".jun"));
    process.chdir(testDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await fsp.rm(testDir, {recursive: true, force: true});
  });

  it("should kill a running process and report success", async () => {
    // Setup: Start a background process using the programmatic API
    const {pid} = await junStartLogic({
      command: "sleep",
      commandArgs: ["10"],
    });
    await sleep(500); // Give jun time to write the osPid

    // Pre-condition check
    const runningTasksBefore = await junLsLogic();
    expect(runningTasksBefore.length).toBe(1);
    expect(runningTasksBefore[0]?.pid).toBe(pid);

    // Act: Call the shellKill tool
    const result = await shellKill({pids: [pid]});

    // Assert the tool's return value
    expect(result.status).toBe("SUCCESS");
    expect(result.killed_count).toBe(1);
    expect(result.failed_pids.length).toBe(0);

    // Assert the side-effect
    const runningTasksAfter = await junLsLogic();
    expect(runningTasksAfter.length).toBe(0);

    const history = await junHistoryLogic();
    const killedTask = history.find((t) => t.pid === pid);
    assert.ok(killedTask);
    expect(killedTask.status).toBe("killed");
  });
});
