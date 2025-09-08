import {junCatLogic} from "@jixo/jun";
import {execaNode} from "execa";
import fsp from "node:fs/promises";
import {createRequire} from "node:module";
import os from "node:os";
import path from "node:path";
import {afterEach, beforeEach, describe, expect, it} from "vitest";

const require = createRequire(import.meta.url);

describe("shellCat tool", () => {
  let testDir: string;
  let originalCwd: string;
  let cliPath: string;

  beforeEach(async () => {
    testDir = await fsp.mkdtemp(path.join(os.tmpdir(), "shell_cat_test_"));
    originalCwd = process.cwd();
    process.chdir(testDir);
    cliPath = require.resolve("@jixo/jun/cli");
    await execaNode(cliPath, ["init"]);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await fsp.rm(testDir, {recursive: true, force: true});
  });

  it("should return logs for a valid pid and report failures for an invalid one", async () => {
    await execaNode(cliPath, ["run", "echo", "hello"]);

    const args = {pids: [1, 99]}; // task 1 should exist, 99 should not
    const result = await junCatLogic(args.pids);

    expect(Object.keys(result.failed).length).toBe(1);
    expect(Object.keys(result.success).length).toBe(1);

    // Check successful cat
    const task1Log = result.success[1];
    expect(task1Log).toBeDefined();
    expect(task1Log.pid).toBe(1);
    expect(Array.isArray(task1Log.stdio)).toBe(true);
    expect(task1Log.stdio.some((log) => log.type === "output" && log.content.includes("hello"))).toBe(true);

    // Check failed cat
    expect(result.failed[99]).toBeDefined();
    expect(result.failed[99]).toBe("Task not found.");
  });
});
