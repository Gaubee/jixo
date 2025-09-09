import {junLsLogic} from "@jixo/jun";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {afterEach, beforeEach, describe, expect, it} from "vitest";
import {functionCall as shellStart} from "../shellStart.function_call.js";

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("shellStart tool", () => {
  let testDir: string;
  let originalCwd: string;

  beforeEach(async (t) => {
    testDir = await fsp.mkdtemp(path.join(os.tmpdir(), `shell_start_test_${t.task.id}_`));
    originalCwd = process.cwd();
    await fsp.mkdir(path.resolve(testDir, ".jun"));
    process.chdir(testDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await fsp.rm(testDir, {recursive: true, force: true});
  });

  it("should start a background command and return its pid", async () => {
    const result = await shellStart({
      command: "sleep",
      args: ["10"],
      mode: "tty",
    });

    expect(result.pid).toBe(1);

    await sleep(500); // Allow time for registration

    const runningTasks = await junLsLogic();
    expect(runningTasks.length).toBe(1);
    expect(runningTasks[0]?.pid).toBe(1);
    expect(runningTasks[0]?.status).toBe("running");
  });
});
