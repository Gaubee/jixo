import {junStartLogic} from "@jixo/jun";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {afterEach, beforeEach, describe, expect, it} from "vitest";
import {functionCall as shellList} from "../shellList.function_call.js";

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("shellList tool", () => {
  let testDir: string;
  let originalCwd: string;

  beforeEach(async (t) => {
    testDir = await fsp.mkdtemp(path.join(os.tmpdir(), "shell_list_test_"));
    originalCwd = process.cwd();
    await fsp.mkdir(path.resolve(testDir, ".jun"));
    process.chdir(testDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await fsp.rm(testDir, {recursive: true, force: true});
  });

  it("should return a list of genuinely running tasks", async () => {
    // Setup
    await junStartLogic({command: "sleep", commandArgs: ["10"]});
    await sleep(500); // Give jun time to register the process

    // Act
    const result = await shellList({});

    // Assert
    expect(result.length).toBe(1);
    expect(result[0]?.command).toBe("sleep");
    expect(result[0]?.status).toBe("running");
  });

  it("should return an empty list when no tasks are running", async () => {
    // Act
    const result = await shellList({});

    // Assert
    expect(result.length).toBe(0);
  });
});
