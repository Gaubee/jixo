import {assertEquals} from "jsr:@std/assert";
import {afterEach, beforeEach, describe, it} from "jsr:@std/testing/bdd";
import {junInitLogic, junRunLogic} from "@jixo/jun";
import {functionCall, paramsSchema} from "./shellList.js";

describe("shellList tool", () => {
  let testDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    testDir = await Deno.makeTempDir({prefix: "shell_list_test_"});
    originalCwd = Deno.cwd();
    Deno.chdir(testDir);
    await junInitLogic();
  });

  afterEach(async () => {
    Deno.chdir(originalCwd);
    await Deno.remove(testDir, {recursive: true});
  });

  it("should return an empty list when no tasks are running", async () => {
    // Run a quick command that completes
    await junRunLogic("echo", ["test"]);

    const args = {};
    paramsSchema.parse(args);
    const result = await functionCall(args);

    assertEquals(result.status, "SUCCESS");
    assertEquals(result.running_tasks.length, 0);
  });

  it("should return a list of genuinely running tasks", async () => {
    // Start a background process that will run for a bit
    const bgProcess = new Deno.Command(Deno.execPath(), {
      args: ["run", "-A", "jsr:@jixo/jun/cli", "run", "sleep", "1"],
      cwd: testDir,
    }).spawn();

    // Allow some time for the process to be registered
    await new Promise((resolve) => setTimeout(resolve, 300));

    const result = await functionCall({});

    assertEquals(result.status, "SUCCESS");
    assertEquals(result.running_tasks.length, 1);
    assertEquals(result.running_tasks[0]?.command, "sleep");
    assertEquals(result.running_tasks[0]?.status, "running");

    // Cleanup
    try {
      bgProcess.kill();
    } catch {}
    await bgProcess.status;
  });
});

// JIXO_CODER_EOF
