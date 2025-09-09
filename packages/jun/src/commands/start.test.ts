import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {getJunDir, readMeta} from "../state.js";
import {junLsLogic} from "./ls.js";
import {junStartLogic} from "./start.js";

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("junStartLogic", () => {
  let testDir: string;
  let originalCwd: string;

  beforeEach(async (t) => {
    originalCwd = process.cwd();
    testDir = await fsp.mkdtemp(path.join(os.tmpdir(), `jun_start_logic_test_${t.task.id}_`));
    await fsp.mkdir(path.resolve(testDir, ".jun"));
    process.chdir(testDir);
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await fsp.rm(testDir, {recursive: true, force: true});
    vi.restoreAllMocks();
  });

  it("should start a background command and return the pid", async () => {
    const result = await junStartLogic({
      command: "sleep",
      commandArgs: ["1"],
    });

    expect(result.pid).toBe(1);

    // Allow some time for the process to be registered
    await sleep(200);

    const runningTasks = await junLsLogic();
    expect(runningTasks.length).toBe(1);
    expect(runningTasks[0]?.pid).toBe(1);
    expect(runningTasks[0]?.status).toBe("running");

    // Wait for the task to finish on its own
    await sleep(1000);
    const finalTasks = await readMeta(await getJunDir());
    expect(finalTasks.get(1)?.status).toBe("completed");
  });
});
