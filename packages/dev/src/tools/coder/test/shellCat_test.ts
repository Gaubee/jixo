import {assert, assertEquals, assertExists} from "jsr:@std/assert";
import {afterEach, beforeEach, describe, it} from "jsr:@std/testing/bdd";
import {junInitLogic, junRunLogic} from "@jixo/jun";
import {functionCall, paramsSchema} from "./shellCat.js";

describe("shellCat tool", () => {
  let testDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    testDir = await Deno.makeTempDir({prefix: "shell_cat_test_"});
    originalCwd = Deno.cwd();
    Deno.chdir(testDir);
    await junInitLogic();
  });

  afterEach(async () => {
    Deno.chdir(originalCwd);
    await Deno.remove(testDir, {recursive: true});
  });

  it("should return logs for a valid pid and report failures for an invalid one", async () => {
    await junRunLogic("echo", ["hello"]);

    const args = {pids: [1, 99]}; // task 1 should exist, 99 should not
    paramsSchema.parse(args);
    const result = await functionCall(args);

    assertEquals(result.status, "SUCCESS");

    // Check successful cat
    assertExists(result.tasks[1]);
    assertEquals(result.tasks[1]?.pid, 1);
    assert(Array.isArray(result.tasks[1]?.stdio));
    assert(result.tasks[1]?.stdio.some((log) => log.type === "stdout" && log.content.includes("hello")));

    // Check failed cat
    assertExists(result.failed_pids[99]);
    assertEquals(result.failed_pids[99], "Task not found.");
  });
});

// JIXO_CODER_EOF
