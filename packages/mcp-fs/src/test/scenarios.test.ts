import assert from "node:assert";
import path from "node:path";
import {afterEach, beforeEach, describe, test} from "node:test";
import {config} from "../fs-utils/config.js";
import {cleanupSandbox, getToolHandler, SANDBOX, setupSandbox} from "./test-helper.js";

describe("MCP Filesystem Tools - Scenarios", () => {
  beforeEach(() => {
    setupSandbox();
    config.allowedDirectories = [SANDBOX];
  });

  afterEach(() => {
    cleanupSandbox();
    config.allowedDirectories = [];
  });

  test("Full project setup workflow", async () => {
    const createDir = getToolHandler("create_directory");
    const writeFile = getToolHandler("write_file");
    const listDir = getToolHandler("list_directory");
    const editFile = getToolHandler("edit_file");
    const readFile = getToolHandler("read_file");
    const deletePath = getToolHandler("delete_path");

    // 1. Create project structure
    const srcDir = path.join(SANDBOX, "src");
    const testDir = path.join(SANDBOX, "test");
    await createDir({path: srcDir});
    await createDir({path: testDir});

    // 2. Write initial files
    const mainFilePath = path.join(srcDir, "main.js");
    const configFilePath = path.join(SANDBOX, "config.json");
    await writeFile({path: mainFilePath, content: `console.log("hello");`});
    await writeFile({path: configFilePath, content: `{"version": "1.0.0"}`});

    // 3. Verify structure
    const rootListResult = await listDir({path: SANDBOX});
    assert.ok(rootListResult.structuredContent.success);
    const rootNames = rootListResult.structuredContent.result.entries.map((e) => e.name).sort();
    assert.deepStrictEqual(rootNames, ["config.json", "src", "test"]);

    // 4. Edit a file
    await editFile({path: configFilePath, edits: [{oldText: `"1.0.0"`, newText: `"1.0.1"`}]});
    const readConfigResult = await readFile({path: configFilePath});
    assert.ok(readConfigResult.structuredContent.success);
    assert.ok(readConfigResult.structuredContent.result.content.includes(`"1.0.1"`));

    // 5. Clean up a file
    await deletePath({path: mainFilePath});
    const srcListResult = await listDir({path: srcDir});
    assert.ok(srcListResult.structuredContent.success);
    assert.strictEqual(srcListResult.structuredContent.result.entries.length, 0);
  });
});
