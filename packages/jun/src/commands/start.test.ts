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
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await fsp.rm(testDir, {recursive: true, force: true});
    vi.restoreAllMocks();
  });

  it("should run a simple command to completion", async () => {
    const exitCode = await junRunLogic({command: "echo", commandArgs: ["hello"], json: false, output: "raw"});
    expect(exitCode).toBe(0);

    const junDir = await getJunDir();
    const tasks = await readMeta(junDir);
    expect(tasks.size).toBe(1);
    const task = tasks.get(1);
    expect(task).toBeDefined();
    expect(task?.status).toBe("completed");
  });

  it("should run a foreground command with --json output", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await junRunLogic({command: "echo", commandArgs: ["hello"], json: true, output: "raw"});

    const stdout = logSpy.mock.calls.map((call) => call.join(" ")).join("\n");
    const parsedOutput = JSON.parse(stdout);
    expect(parsedOutput.status).toBe("STARTED_IN_FOREGROUND");
    expect(parsedOutput.pid).toBe(1);
    expect(parsedOutput.osPid).toBeDefined();
  });

  it("should strip ansi codes when output is 'text'", async () => {
    const writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const command = "node";
    const commandArgs = ["-e", "console.log('\\u001b[31mHello\\u001b[39m')"]; // Node command to print red "Hello"

    await junRunLogic({command, commandArgs, json: false, output: "text"});

    const writtenContent = writeSpy.mock.calls.map((call) => call[0].toString()).join("");
    expect(writtenContent).toContain("Hello");
    expect(writtenContent).not.toContain("\u001b[31m");
  });
});
