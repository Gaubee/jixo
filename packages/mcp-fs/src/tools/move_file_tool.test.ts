import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import {it} from "vitest";
import {createIsolatedTestSuite} from "../test/test-helper.js";

createIsolatedTestSuite("move_file", (context) => {
  it("should move a file and return correct structured output", async () => {
    const handler = context.getTool("move_file");
    const sourcePath = path.join(context.sandboxPath, "source.txt");
    const destPath = path.join(context.sandboxPath, "dest.txt");
    fs.writeFileSync(sourcePath, "content");

    const result = await handler({source: sourcePath, destination: destPath});
    assert.ok(result.structuredContent.success);
    assert.strictEqual(result.structuredContent.result.source, sourcePath);
    assert.strictEqual(result.structuredContent.result.destination, destPath);
    assert.ok(!fs.existsSync(sourcePath));
    assert.ok(fs.existsSync(destPath));
  });

  it("should return FileNotFoundError if source does not exist", async () => {
    const handler = context.getTool("move_file");
    const result = await handler({source: "./nonexistent.txt", destination: "./dest.txt"});
    assert.ok(!result.structuredContent.success);
    assert.strictEqual(result.structuredContent.error.name, "FileNotFoundError");
  });
});
