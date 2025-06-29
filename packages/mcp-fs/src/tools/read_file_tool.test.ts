import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import {it} from "vitest";
import {createIsolatedTestSuite} from "../test/test-helper.js";

createIsolatedTestSuite("read_file", (context) => {
  it("should read a file and return correct structured output", async () => {
    const handler = context.getTool("read_file");
    const filePath = path.join(context.sandboxPath, "file.txt");
    fs.writeFileSync(filePath, "hello world");

    const result = await handler({path: filePath});
    assert.ok(result.structuredContent.success);
    assert.strictEqual(result.structuredContent.result.path, filePath);
    assert.strictEqual(result.structuredContent.result.content, "hello world");
  });

  it("should return InvalidOperationError when trying to read a directory", async () => {
    const handler = context.getTool("read_file");
    const dirPath = path.join(context.sandboxPath, "dir");
    fs.mkdirSync(dirPath);

    const result = await handler({path: dirPath});
    assert.ok(!result.structuredContent.success);
    assert.strictEqual(result.structuredContent.error.name, "InvalidOperationError");
  });
});
