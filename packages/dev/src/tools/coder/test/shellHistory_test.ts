import {assert, assertEquals} from "jsr:@std/assert";
import {afterEach, beforeEach, describe, it} from "jsr:@std/testing/bdd";
import {junInitLogic, junRunLogic} from "@jixo/jun";
import {functionCall, paramsSchema} from "./shellHistory.js";

describe("shellHistory tool", () => {
  let testDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    testDir = await Deno.makeTempDir({prefix: "shell_history_test_"});
    originalCwd = Deno.cwd();
    Deno.chdir(testDir);
    await junInitLogic();
  });

  afterEach(async () => {
    Deno.chdir(originalCwd);
    await Deno.remove(testDir, {recursive: true});
  });

  it("should return a list of all tasks after running some", async () => {
    await junRunLogic("echo", ["task1"]);
    await junRunLogic("false", []); // This one will have "error" status

    const args = {};
    paramsSchema.parse(args);
    const result = await functionCall(args);

    assertEquals(result.status, "SUCCESS");
    assertEquals(result.history.length, 2);
    assert(result.history.some((task) => task.status === "completed"));
    assert(result.history.some((task) => task.status === "error"));
  });
});

// JIXO_CODER_EOF
