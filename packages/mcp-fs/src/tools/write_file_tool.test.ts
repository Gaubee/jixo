import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import {it} from "vitest";
import {createIsolatedTestSuite} from "../test/test-helper.js";

createIsolatedTestSuite("write_file", (context) => {
  it("should write a file and return correct structured output", async () => {
    const handler = context.getTool("write_file");
    const filePath = path.join(context.sandboxPath, "file.txt");

    const result = await handler({path: filePath, content: "hello"});
    assert.ok(result.structuredContent.success);
    assert.strictEqual(result.structuredContent.result.path, filePath);
    assert.strictEqual(fs.readFileSync(filePath, "utf-8"), "hello");
  });

  it("should return InvalidOperationError when path is a directory", async () => {
    const handler = context.getTool("write_file");
    const dirPath = path.join(context.sandboxPath, "dir");
    fs.mkdirSync(dirPath);

    const result = await handler({path: dirPath, content: "hello"});
    assert.ok(!result.structuredContent.success);
    assert.strictEqual(result.structuredContent.error.name, "InvalidOperationError");
  });
});
