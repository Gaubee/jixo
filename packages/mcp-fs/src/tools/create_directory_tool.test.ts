import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import {it} from "vitest";
import {createIsolatedTestSuite} from "../test/test-helper.js";

createIsolatedTestSuite("create_directory", (context) => {
  it("should create a directory and return correct structured output", async () => {
    const handler = context.getTool("create_directory");
    const dirPath = path.join(context.sandboxPath, "new-dir");

    const result = await handler({path: dirPath});
    assert.ok(result.structuredContent.success);
    assert.strictEqual(result.structuredContent.result.path, dirPath);
    assert.ok(fs.existsSync(dirPath));
  });

  it("should return NotADirectoryError if part of the path is a file", async () => {
    const handler = context.getTool("create_directory");
    const filePath = path.join(context.sandboxPath, "file.txt");
    fs.writeFileSync(filePath, "content");

    const result = await handler({path: path.join(filePath, "new-dir")});
    assert.ok(!result.structuredContent.success);
    assert.strictEqual(result.structuredContent.error.name, "NotADirectoryError");
  });
});
