import {junHistoryLogic} from "@jixo/jun";
import {execaNode} from "execa";
import fsp from "node:fs/promises";
import {createRequire} from "node:module";
import os from "node:os";
import path from "node:path";
import {afterEach, beforeEach, describe, expect, it} from "vitest";
import {functionCall as shellRun} from "../shellRun.function_call.js";

const require = createRequire(import.meta.url);

describe("shellRun tool (foreground)", () => {
  let testDir: string;
  let originalCwd: string;
  let cliPath: string;

  beforeEach(async () => {
    testDir = await fsp.mkdtemp(path.join(os.tmpdir(), "shell_run_test_"));
    originalCwd = process.cwd();
    process.chdir(testDir);
    cliPath = require.resolve("@jixo/jun/cli");
    await execaNode(cliPath, ["init"]);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await fsp.rm(testDir, {recursive: true, force: true});
  });

  it("should run a foreground command and wait for completion", async () => {
    const result = await shellRun({
      command: "echo",
      args: ["hello"],
      mode: "cp",
      output: "text",
    });

    expect(result.status).toBe("COMPLETED");
    expect(result.exit_code).toBe(0);

    const history = await junHistoryLogic();
    expect(history.length).toBe(1);
    const task = history[0];
    expect(task).toBeDefined();
    expect(task?.status).toBe("completed");
  });

  it("should return an ERROR status for a failing command", async () => {
    const result = await shellRun({
      command: "node",
      args: ["-e", "process.exit(1)"],
      mode: "cp",
      output: "text",
    });

    expect(result.status).toBe("ERROR");
    expect(result.exit_code).toBe(1);

    const history = await junHistoryLogic();
    expect(history[0]?.status).toBe("error");
  });
});
