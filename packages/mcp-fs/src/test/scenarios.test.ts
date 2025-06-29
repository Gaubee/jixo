import assert from "node:assert";
import path from "node:path";
import {test} from "vitest";
import {createIsolatedTestSuite} from "./test-helper.js";

createIsolatedTestSuite("Scenarios", (context) => {
  test("Full project setup workflow", async () => {
    const {sandboxPath, getTool} = context;
    const createDir = getTool("create_directory");
    const writeFile = getTool("write_file");
    const listDir = getTool("list_directory");
    const editFile = getTool("edit_file");
    const readFile = getTool("read_file");
    const deletePath = getTool("delete_path");

    // 1. Create project structure
    const srcDir = path.join(sandboxPath, "src");
    const testDir = path.join(sandboxPath, "test");
    await createDir({path: "src"}); // Use relative path
    await createDir({path: "test"});

    // 2. Write initial files
    const mainFilePath = path.join(srcDir, "main.js");
    const configFilePath = path.join(sandboxPath, "config.json");
    await writeFile({path: "src/main.js", content: `console.log("hello");`});
    await writeFile({path: "config.json", content: `{"version": "1.0.0"}`});

    // 3. Verify structure
    const rootListResult = await listDir({path: "."});
    assert.ok(rootListResult.structuredContent.success);
    const rootNames = rootListResult.structuredContent.result.entries.map((e) => e.name).sort();
    assert.deepStrictEqual(rootNames, ["config.json", "src", "test"]);

    // 4. Edit a file
    await editFile({path: "config.json", edits: [{oldText: `"1.0.0"`, newText: `"1.0.1"`}]});
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
