import {junHistoryLogic, junRmLogic} from "@jixo/jun";
import {execaNode, type ResultPromise} from "execa";
import fsp from "node:fs/promises";
import {createRequire} from "node:module";
import os from "node:os";
import path from "node:path";
import {afterEach, beforeEach, describe, expect, it} from "vitest";

const require = createRequire(import.meta.url);

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("shellRemove tool", () => {
  let testDir: string;
  let originalCwd: string;
  let cliPath: string;
  let backgroundProcesses: ResultPromise[] = [];

  beforeEach(async () => {
    testDir = await fsp.mkdtemp(path.join(os.tmpdir(), "shell_remove_test_"));
    originalCwd = process.cwd();
    process.chdir(testDir);
    cliPath = require.resolve("@jixo/jun/cli");
    await execaNode(cliPath, ["init"]);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await fsp.rm(testDir, {recursive: true, force: true});
    await Promise.allSettled(backgroundProcesses.map((p) => p.kill("SIGKILL")));
  });

  it("should remove a specific completed task by pid", async () => {
    await execaNode(cliPath, ["run", "echo", "task1"]); // pid 1
    await execaNode(cliPath, ["run", "echo", "task2"]); // pid 2

    const result = await junRmLogic({pids: [1]});
    expect(result.removed).toEqual([1]);
    expect(Object.keys(result.skipped).length).toBe(0);

    const history = await junHistoryLogic();
    expect(history.length).toBe(1);
    expect(history[0]?.pid).toBe(2);
  });

  it("should skip removing a running task", async () => {
    const bgProcess = execaNode(cliPath, ["run", "--background", "sleep", "10"], {cwd: testDir});
    backgroundProcesses.push(bgProcess);
    await sleep(500);

    const historyBefore = await junHistoryLogic();
    const runningTask = historyBefore.find((t) => t.status === "running");
    expect(runningTask).toBeDefined();

    const result = await junRmLogic({pids: [runningTask!.pid]});
    expect(result.removed.length).toBe(0);
    expect(result.skipped[runningTask!.pid]).toBeDefined();
  });
});
