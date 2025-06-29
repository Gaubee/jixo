import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import {it} from "vitest";
import {createIsolatedTestSuite} from "../test/test-helper.js";

createIsolatedTestSuite("list_directory", (context) => {
  it("should list directory contents and return correct structured output", async () => {
    const handler = context.getTool("list_directory");
    const dirPath = path.join(context.sandboxPath, "dir");
    const filePath = path.join(dirPath, "file.txt");
    fs.mkdirSync(dirPath);
    fs.writeFileSync(filePath, "");

    const result = await handler({path: ".", maxDepth: 2});
    assert.ok(result.structuredContent.success);
    assert.strictEqual(result.structuredContent.result.path, context.sandboxPath);
    assert.deepStrictEqual(result.structuredContent.result.entries, [
      {
        name: "dir",
        type: "directory",
        children: [{name: "file.txt", type: "file"}],
      },
    ]);
  });

  it("should return NotADirectoryError when path is a file", async () => {
    const handler = context.getTool("list_directory");
    const filePath = path.join(context.sandboxPath, "file.txt");
    fs.writeFileSync(filePath, "content");

    const result = await handler({path: filePath});
    assert.ok(!result.structuredContent.success);
    assert.strictEqual(result.structuredContent.error.name, "NotADirectoryError");
  });
});
