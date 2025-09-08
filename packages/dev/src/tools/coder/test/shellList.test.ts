import {junLsLogic} from "@jixo/jun";
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

describe("shellList tool", () => {
  let testDir: string;
  let originalCwd: string;
  let cliPath: string;
  let backgroundProcesses: ResultPromise[] = [];

  beforeEach(async () => {
    testDir = await fsp.mkdtemp(path.join(os.tmpdir(), "shell_list_test_"));
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

  it("should return an empty list when no tasks are running", async () => {
    await execaNode(cliPath, ["run", "echo", "test"]);
    const result = await junLsLogic();
    expect(result.length).toBe(0);
  });

  it("should return a list of genuinely running tasks", async () => {
    const bgProcess = execaNode(cliPath, ["start", "sleep", "10"], {cwd: testDir});
    backgroundProcesses.push(bgProcess);
    await sleep(500);

    const result = await junLsLogic();
    expect(result.length).toBe(1);
    expect(result[0]?.command).toBe("sleep");
    expect(result[0]?.status).toBe("running");
  });
});
