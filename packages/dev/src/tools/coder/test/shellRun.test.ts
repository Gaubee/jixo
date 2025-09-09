import assert from "node:assert";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {afterEach, beforeEach, describe, expect, it} from "vitest";
import {functionCall as shellRun} from "../shellRun.function_call.js";

describe("shellRun tool", () => {
  let testDir: string;
  let originalCwd: string;

  beforeEach(async (t) => {
    originalCwd = process.cwd();
    testDir = await fsp.mkdtemp(path.join(os.tmpdir(), `shell_run_test_${t.task.id}_`));
    await fsp.mkdir(path.resolve(testDir, ".jun"));
    process.chdir(testDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await fsp.rm(testDir, {recursive: true, force: true});
  });

  it("should return full result for a successful command", async () => {
    const result = await shellRun({
      command: "node",
      args: ["-e", "console.log('out'); console.error('err');"],
      mode: "cp",
    });

    expect(result.status).toBe("COMPLETED");
    expect(result.exitCode).toBe(0);
    assert.ok("stdout" in result);
    expect(result.stdout.trim()).toBe("out");
    expect(result.stderr.trim()).toBe("err");
  });

  it("should return full result for a failed command", async () => {
    const result = await shellRun({
      command: "node",
      args: ["-e", "process.exit(123)"],
      mode: "cp",
    });

    expect(result.status).toBe("ERROR");
    expect(result.exitCode).toBe(123);
  });

  it("should return a timeout status when timeout is exceeded", async () => {
    const result = await shellRun({
      command: "sleep",
      args: ["5"],
      timeout: 100,
      mode: "cp",
    });

    expect(result.status).toBe("TIMEOUT");
  });
});
