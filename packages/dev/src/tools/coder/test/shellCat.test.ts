import {junRunLogic} from "@jixo/jun";
import assert from "node:assert";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {afterEach, beforeEach, describe, expect, it} from "vitest";
import {functionCall as shellCat} from "../shellCat.function_call.js";

describe("shellCat tool", () => {
  let testDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    testDir = await fsp.mkdtemp(path.join(os.tmpdir(), "shell_cat_test_"));
    originalCwd = process.cwd();
    await fsp.mkdir(path.resolve(testDir, ".jun"));
    process.chdir(testDir);
    // No need to init, jun logics will handle dir creation
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await fsp.rm(testDir, {recursive: true, force: true});
  });

  it("should return logs for a valid pid and report failures for an invalid one", async () => {
    // Setup: Run a command to create a history entry
    await junRunLogic({
      command: "echo",
      commandArgs: ["hello"],
      mode: "cp",
    });

    // Act: Call the shellCat tool
    const result = await shellCat({pids: [1, 99]});

    // Assert
    expect(Object.keys(result.failed).length).toBe(1);
    expect(Object.keys(result.success).length).toBe(1);

    const task1Log = result.success[0];
    assert.ok(task1Log, "Task 1 log should be defined");
    expect(task1Log.pid).toBe(1);
    expect(task1Log.stdio.some((log) => log.type === "stdout" && log.content.includes("hello"))).toBe(true);

    assert.ok(result.failed.at(0)?.pid === 99, "Failed PID 99 should be in the result");
    expect(result.failed.at(0)?.reason).toBe("Task not found.");
  });
});
