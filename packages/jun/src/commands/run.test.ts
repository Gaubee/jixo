import type {ResultPromise} from "execa";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {junStartLogic} from "./start.js";

describe("junStartLogic", () => {
  let testDir: string;
  let originalCwd: string;
  let backgroundProcesses: ResultPromise[] = [];

  beforeEach(async (t) => {
    originalCwd = process.cwd();
    testDir = await fsp.mkdtemp(path.join(os.tmpdir(), `jun_start_logic_test_${t.task.id}_`));
    await fsp.mkdir(path.resolve(testDir, ".jun"));
    process.chdir(testDir);
    backgroundProcesses = [];
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await fsp.rm(testDir, {recursive: true, force: true});
    vi.restoreAllMocks();
    // Clean up any tracked background processes
    await Promise.allSettled(
      backgroundProcesses.map((p) => {
        if (p.pid && !p.killed) {
          try {
            process.kill(p.pid, "SIGKILL");
          } catch {}
        }
        return p.catch((e) => {
          if (!e.isTerminated) throw e;
        });
      }),
    );
  });

  it("should start a background command and exit immediately", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const exitCode = await junStartLogic({
      command: "sleep",
      commandArgs: ["1"],
      json: true,
      output: "raw",
      onBackgroundProcess: (p) => backgroundProcesses.push(p),
    });
    expect(exitCode).toBe(0);

    const stdout = logSpy.mock.calls.map((call) => call.join(" ")).join("\n");
    const parsedOutput = JSON.parse(stdout);
    expect(parsedOutput.status).toBe("STARTED_IN_BACKGROUND");
    expect(parsedOutput.pid).toBe(1);
    expect(parsedOutput.osPid).toBeDefined();
  });
});
