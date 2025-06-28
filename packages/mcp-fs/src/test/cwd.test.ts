import assert from "node:assert";
import path from "node:path";
import {afterEach, beforeEach, describe, test} from "node:test";
import {cleanupSandbox, getToolHandler, SANDBOX, setupSandbox} from "./test-helper.js";

describe("CWD Interaction", () => {
  beforeEach(() => {
    setupSandbox();
  });

  afterEach(() => {
    cleanupSandbox();
  });

  test("should get and set CWD correctly", async () => {
    const getCwd = getToolHandler("get_cwd");
    const setCwd = getToolHandler("set_cwd");
    const createDir = getToolHandler("create_directory");

    const initialCwdResult = await getCwd({});
    assert.ok(initialCwdResult.structuredContent.success);
    assert.strictEqual(initialCwdResult.structuredContent.result.cwd, SANDBOX);

    const subDirPath = path.join(SANDBOX, "subdir");
    await createDir({path: subDirPath});

    const setCwdResult = await setCwd({path: subDirPath});
    assert.ok(setCwdResult.structuredContent.success);
    assert.strictEqual(setCwdResult.structuredContent.result.newCwd, subDirPath);

    const newCwdResult = await getCwd({});
    assert.ok(newCwdResult.structuredContent.success);
    assert.strictEqual(newCwdResult.structuredContent.result.cwd, subDirPath);
  });

  test("should resolve relative paths from the new CWD", async () => {
    const setCwd = getToolHandler("set_cwd");
    const createDir = getToolHandler("create_directory");
    const writeFile = getToolHandler("write_file");
    const readFile = getToolHandler("read_file");

    const subDirPath = path.join(SANDBOX, "app");
    await createDir({path: subDirPath});
    await setCwd({path: subDirPath});

    // Now, CWD is /app. Let's write a file to './src/index.js'
    await createDir({path: "./src"});
    await writeFile({path: "./src/index.js", content: "hello from subdir"});

    const contentResult = await readFile({path: path.join(subDirPath, "src/index.js")});
    assert.ok(contentResult.structuredContent.success);
    assert.strictEqual(contentResult.structuredContent.result.content, "hello from subdir");
  });

  test("should fail to set CWD to a file", async () => {
    const setCwd = getToolHandler("set_cwd");
    const writeFile = getToolHandler("write_file");
    const filePath = path.join(SANDBOX, "file.txt");
    await writeFile({path: filePath, content: ""});

    const result = await setCwd({path: filePath});
    assert.ok(!result.structuredContent.success);
    assert.strictEqual(result.structuredContent.error.name, "NotADirectoryError");
  });
});
