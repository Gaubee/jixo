import {junLsLogic} from "@jixo/jun";
import {execaNode, type ResultPromise} from "execa";
import fsp from "node:fs/promises";
import {createRequire} from "node:module";
import os from "node:os";
import path from "node:path";
import {afterEach, beforeEach, describe, expect, it} from "vitest";
import {functionCall as shellStart} from "../shellStart.function_call.js";

const require = createRequire(import.meta.url);

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("shellStart tool (background)", () => {
  let testDir: string;
  let originalCwd: string;
  let cliPath: string;
  let backgroundProcesses: ResultPromise[] = [];

  beforeEach(async () => {
    testDir = await fsp.mkdtemp(path.join(os.tmpdir(), "shell_start_test_"));
    originalCwd = process.cwd();
    process.chdir(testDir);
    cliPath = require.resolve("@jixo/jun/cli");
    await execaNode(cliPath, ["init"]);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await fsp.rm(testDir, {recursive: true, force: true});
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

  it("should run a background command and return immediately with a pid", async () => {
    const result = await shellStart({
      command: "sleep",
      args: ["10"],
      mode: "tty",
      output: "text",
    });

    expect(result.status).toBe("STARTED_IN_BACKGROUND");
    expect(result.pid).toBe(1);
    expect(result.osPid).toBeDefined();

    // Allow some time for the process to be registered by jun
    await sleep(500);

    const runningTasks = await junLsLogic();
    expect(runningTasks.length).toBe(1);
    const task = runningTasks[0];
    expect(task?.status).toBe("running");
    expect(task?.command).toBe("sleep");
  });
});
