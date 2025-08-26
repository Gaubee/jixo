import {assert, assertEquals, assertExists} from "@std/assert";
import {resolve} from "@std/path";
import {afterEach, beforeEach, describe, it} from "@std/testing/bdd";
import {getJunDir, readMeta} from "../state.ts";
import {junRunLogic} from "./run.ts";

describe("junRunLogic", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await Deno.makeTempDir({prefix: "jun_run_logic_test_"});
    // Force getJunDir to use our test directory by creating a .jun subdir
    await Deno.mkdir(resolve(testDir, ".jun"));
    Deno.chdir(testDir);
  });

  afterEach(async () => {
    // Change back to original directory to avoid side effects
    Deno.chdir("..");
    await Deno.remove(testDir, {recursive: true});
  });

  it("should run a simple command to completion and update metadata", async () => {
    const exitCode = await junRunLogic("echo", ["hello", "world"]);
    assertEquals(exitCode, 0);

    const junDir = await getJunDir();
    const tasks = await readMeta(junDir);
    assertEquals(tasks.size, 1);

    const task = tasks.get(1);
    assertExists(task);
    assertEquals(task.pid, 1);
    assertEquals(task.command, "echo");
    assertEquals(task.status, "completed");
    assertExists(task.endTime);
  });

  it("should capture the exit code of a failing command", async () => {
    // 'false' is a standard unix command that does nothing and exits with 1
    const exitCode = await junRunLogic("false", []);
    assertEquals(exitCode, 1);

    const junDir = await getJunDir();
    const tasks = await readMeta(junDir);
    const task = tasks.get(1);
    assertExists(task);
    assertEquals(task.status, "error");
  });

  it("should create a log file with stdio content", async () => {
    await junRunLogic("sh", ["-c", 'echo "out" && echo "err" >&2']);

    const junDir = await getJunDir();
    const logPath = resolve(junDir, "logs", "1.jsonl");
    const logContent = await Deno.readTextFile(logPath);

    assert(logContent.includes('"type":"stdout"'));
    assert(logContent.includes('"content":"out\\n"'));
    assert(logContent.includes('"type":"stderr"'));
    assert(logContent.includes('"content":"err\\n"'));
  });
});

// JIXO_CODER_EOF
