import {junHistoryLogic, junKillLogic, junLsLogic} from "@jixo/jun";
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

describe("shellKill tool", () => {
  let testDir: string;
  let originalCwd: string;
  let cliPath: string;
  let backgroundProcesses: ResultPromise[] = [];

  beforeEach(async () => {
    testDir = await fsp.mkdtemp(path.join(os.tmpdir(), "shell_kill_test_"));
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

  it("should kill a running process and report success", async () => {
    const bgProcess = execaNode(cliPath, ["start", "sleep", "10"], {cwd: testDir});
    backgroundProcesses.push(bgProcess);

    await sleep(500); // Wait for it to be listed
    const listResult = await junLsLogic();
    expect(listResult.length).toBeGreaterThan(0);
    const runningTaskPid = listResult[0]!.pid;

    const killResult = await junKillLogic({pids: [runningTaskPid]});
    expect(killResult.killedCount).toBe(1);

    const listAfterKill = await junLsLogic();
    expect(listAfterKill.length).toBe(0);

    const history = await junHistoryLogic();
    const killedTask = history.find((t) => t.pid === runningTaskPid);
    expect(killedTask?.status).toBe("killed");
  });
});
