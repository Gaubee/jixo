import {junRunLogic} from "@jixo/jun";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {afterEach, beforeEach, describe, expect, it} from "vitest";
import {functionCall as shellHistory} from "../shellHistory.function_call.js";

describe("shellHistory tool", () => {
  let testDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    testDir = await fsp.mkdtemp(path.join(os.tmpdir(), "shell_history_test_"));
    originalCwd = process.cwd();
    await fsp.mkdir(path.resolve(testDir, ".jun"));
    process.chdir(testDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await fsp.rm(testDir, {recursive: true, force: true});
  });

  it("should return a list of all tasks after running some", async () => {
    // Setup
    await junRunLogic({command: "echo", commandArgs: ["task1"], mode: "cp"});
    await junRunLogic({command: "node", commandArgs: ["-e", "process.exit(1)"], mode: "cp"});

    // Act
    const result = await shellHistory({});

    // Assert
    expect(result.length).toBe(2);
    expect(result[0]?.pid).toBe(2); // Sorted descending
    expect(result[1]?.pid).toBe(1);
    expect(result.some((task) => task.status === "completed")).toBe(true);
    expect(result.some((task) => task.status === "error")).toBe(true);
  });
});
