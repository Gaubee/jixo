import {junHistoryLogic, junRunLogic, junStartLogic} from "@jixo/jun";
import assert from "node:assert";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {afterEach, beforeEach, describe, expect, it} from "vitest";
import {functionCall as shellRemove} from "../shellRemove.function_call.js";

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("shellRemove tool", () => {
  let testDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    testDir = await fsp.mkdtemp(path.join(os.tmpdir(), "shell_remove_test_"));
    originalCwd = process.cwd();
    await fsp.mkdir(path.resolve(testDir, ".jun"));
    process.chdir(testDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await fsp.rm(testDir, {recursive: true, force: true});
  });

  it("should remove a specific completed task by pid", async () => {
    // Setup
    await junRunLogic({command: "echo", commandArgs: ["task1"], mode: "cp"}); // pid 1
    await junRunLogic({command: "echo", commandArgs: ["task2"], mode: "cp"}); // pid 2

    // Act
    const result = await shellRemove({pids: [1]});

    // Assert tool's return value
    expect(result.removed_pids).toEqual([1]);
    expect(result.skipped.length).toBe(0);

    // Assert side-effect
    const history = await junHistoryLogic();
    expect(history.length).toBe(1);
    expect(history[0]?.pid).toBe(2);
  });

  it("should skip removing a running task", async () => {
    // Setup
    const {pid} = await junStartLogic({command: "sleep", commandArgs: ["10"]});
    await sleep(500);

    // Act
    const result = await shellRemove({pids: [pid]});

    // Assert tool's return value
    expect(result.removed_pids.length).toBe(0);
    expect(result.skipped.length).toBe(1);
    assert.ok(result.skipped.find((p) => p.pid === pid));

    // Assert side-effect
    const history = await junHistoryLogic();
    expect(history.length).toBe(1);
    expect(history[0]?.status).toBe("running");
  });
});
