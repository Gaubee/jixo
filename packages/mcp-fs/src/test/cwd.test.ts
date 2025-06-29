import assert from "node:assert";
import path from "node:path";
import {test} from "vitest";
import {createIsolatedTestSuite} from "./test-helper.js";

createIsolatedTestSuite("CWD Interaction", (context) => {
  test("should get and set CWD correctly", async () => {
    const {sandboxPath, getTool} = context;
    const getCwd = getTool("get_cwd");
    const setCwd = getTool("set_cwd");
    const createDir = getTool("create_directory");

    const initialCwdResult = await getCwd({});
    assert.ok(initialCwdResult.structuredContent.success);
    assert.strictEqual(initialCwdResult.structuredContent.result.cwd, sandboxPath);

    const subDirPath = path.join(sandboxPath, "subdir");
    await createDir({path: "subdir"}); // relative path

    const setCwdResult = await setCwd({path: subDirPath});
    assert.ok(setCwdResult.structuredContent.success);
    assert.strictEqual(setCwdResult.structuredContent.result.newCwd, subDirPath);

    const newCwdResult = await getCwd({});
    assert.ok(newCwdResult.structuredContent.success);
    assert.strictEqual(newCwdResult.structuredContent.result.cwd, subDirPath);
  });

  test("should resolve relative paths from the new CWD", async () => {
    const {getTool} = context;
    const setCwd = getTool("set_cwd");
    const createDir = getTool("create_directory");
    const writeFile = getTool("write_file");
    const readFile = getTool("read_file");

    const subDirPath = path.join(context.sandboxPath, "app");
    await createDir({path: "app"});
    await setCwd({path: "app"});

    await createDir({path: "./src"});
    await writeFile({path: "./src/index.js", content: "hello from subdir"});

    const contentResult = await readFile({path: path.join(subDirPath, "src/index.js")});
    assert.ok(contentResult.structuredContent.success);
    assert.strictEqual(contentResult.structuredContent.result.content, "hello from subdir");
  });

  test("should fail to set CWD to a file", async () => {
    const {getTool} = context;
    const setCwd = getTool("set_cwd");
    const writeFile = getTool("write_file");
    const filePath = path.join(context.sandboxPath, "file.txt");
    await writeFile({path: "file.txt", content: ""});

    const result = await setCwd({path: filePath});
    assert.ok(!result.structuredContent.success);
    assert.strictEqual(result.structuredContent.error.name, "NotADirectoryError");
  });
});
