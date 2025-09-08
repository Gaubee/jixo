import {junHistoryLogic} from "@jixo/jun";
import {execaNode} from "execa";
import fsp from "node:fs/promises";
import {createRequire} from "node:module";
import os from "node:os";
import path from "node:path";
import {afterEach, beforeEach, describe, expect, it} from "vitest";

const require = createRequire(import.meta.url);

describe("shellHistory tool", () => {
  let testDir: string;
  let originalCwd: string;
  let cliPath: string;

  beforeEach(async () => {
    testDir = await fsp.mkdtemp(path.join(os.tmpdir(), "shell_history_test_"));
    originalCwd = process.cwd();
    process.chdir(testDir);
    cliPath = require.resolve("@jixo/jun/cli");
    await execaNode(cliPath, ["init"]);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await fsp.rm(testDir, {recursive: true, force: true});
  });

  it("should return a list of all tasks after running some", async () => {
    await execaNode(cliPath, ["run", "echo", "task1"]);
    await execaNode(cliPath, ["run", "false"]).catch(() => {}); // This one will have "error" status

    const result = await junHistoryLogic();

    expect(result.length).toBe(2);
    expect(result.some((task) => task.status === "completed")).toBe(true);
    expect(result.some((task) => task.status === "error")).toBe(true);
  });
});
