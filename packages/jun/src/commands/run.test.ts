import assert from "node:assert";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {getJunDir, readMeta} from "../state.js";
import {junRunLogic} from "./run.js";

describe("junRunLogic", () => {
  let testDir: string;
  let originalCwd: string;

  beforeEach(async (t) => {
    originalCwd = process.cwd();
    testDir = await fsp.mkdtemp(path.join(os.tmpdir(), `jun_run_logic_test_${t.task.id}_`));
    await fsp.mkdir(path.resolve(testDir, ".jun"));
    process.chdir(testDir);
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await fsp.rm(testDir, {recursive: true, force: true});
    vi.restoreAllMocks();
  });

  it("should run a simple command and return a full result object", async () => {
    const result = await junRunLogic({
      command: "node",
      commandArgs: ["-e", `console.log('hello'); console.error('world')`],
      mode: "cp",
    });

    expect(result.pid).toBe(1);
    expect(result.exitCode).toBe(0);
    assert.ok(result.mode === "cp");
    expect(result.stdout.trim()).toBe("hello");
    expect(result.stderr.trim()).toBe("world");
    expect(result.isTimeout).toBe(false);

    const tasks = await readMeta(await getJunDir());
    expect(tasks.get(1)?.status).toBe("completed");
  });

  it("should handle command failure and return a correct result", async () => {
    const result = await junRunLogic({
      command: "node",
      commandArgs: ["-e", `console.error('fail'); process.exit(42)`],
      mode: "cp",
    });

    expect(result.exitCode).toBe(42);
    assert.ok(result.mode === "cp");
    expect(result.stderr.trim()).toBe("fail");
    const tasks = await readMeta(await getJunDir());
    expect(tasks.get(1)?.status).toBe("error");
  });

  it("should respect timeout and set isTimeout flag", async () => {
    const result = await junRunLogic({
      command: "sleep",
      commandArgs: ["5"],
      timeout: 100, // 100ms timeout
    });

    expect(result.isTimeout).toBe(true);
    expect(result.exitCode).not.toBe(0);
    const tasks = await readMeta(await getJunDir());
    expect(tasks.get(1)?.status).toBe("killed");
  });

  it("should respect idleTimeout and set isTimeout flag", async () => {
    const result = await junRunLogic({
      command: "node",
      commandArgs: ["-e", `setTimeout(() => console.log('done'), 500)`], // Finishes after 500ms
      idleTimeout: 100, // 100ms idle timeout
    });

    expect(result.isTimeout).toBe(true);
    expect(result.exitCode).not.toBe(0);
    const tasks = await readMeta(await getJunDir());
    expect(tasks.get(1)?.status).toBe("killed");
  });
});
