import {assertEquals} from "jsr:@std/assert";
import {afterEach, beforeEach, describe, it} from "jsr:@std/testing/bdd";
import {junHistoryLogic, junInitLogic} from "@jixo/jun";
import {functionCall as shellKillFunc} from "./shellKill.js";
import {functionCall as shellListFunc} from "./shellList.js";

describe("shellKill tool", () => {
  let testDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    testDir = await Deno.makeTempDir({prefix: "shell_kill_test_"});
    originalCwd = Deno.cwd();
    Deno.chdir(testDir);
    await junInitLogic();
  });

  afterEach(async () => {
    Deno.chdir(originalCwd);
    await Deno.remove(testDir, {recursive: true});
  });

  it("should kill a running process and report success", async () => {
    // Start a background process
    const bgProcess = new Deno.Command(Deno.execPath(), {
      args: ["run", "-A", "jsr:@jixo/jun/cli", "run", "sleep", "10"],
      cwd: testDir,
    }).spawn();

    // Wait for it to be listed
    let runningTaskPid = -1;
    await new Promise((resolve) => setTimeout(resolve, 300));
    const listResult = await shellListFunc({});
    if (listResult.running_tasks.length > 0) {
      runningTaskPid = listResult.running_tasks[0]!.pid;
    }

    // Kill it
    const killResult = await shellKillFunc({pids: [runningTaskPid]});
    assertEquals(killResult.status, "SUCCESS");
    assertEquals(killResult.killed_count, 1);

    // Verify it's no longer running
    const listAfterKill = await shellListFunc({});
    assertEquals(listAfterKill.running_tasks.length, 0);

    // Verify its status in history is 'killed'
    const history = await junHistoryLogic();
    const killedTask = history.find((t) => t.pid === runningTaskPid);
    assertEquals(killedTask?.status, "killed");

    // Cleanup
    try {
      bgProcess.kill();
    } catch {}
    await bgProcess.status;
  });
});

// JIXO_CODER_EOF
