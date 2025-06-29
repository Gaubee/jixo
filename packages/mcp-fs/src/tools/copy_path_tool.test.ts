import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import {it} from "vitest";
import {createIsolatedTestSuite} from "../test/test-helper.js";

createIsolatedTestSuite("copy_path", (context) => {
  it("should copy a file and return correct structured output", async () => {
    const handler = context.getTool("copy_path");
    const sourcePath = path.join(context.sandboxPath, "source.txt");
    const destPath = path.join(context.sandboxPath, "dest.txt");
    fs.writeFileSync(sourcePath, "content");

    const result = await handler({source: sourcePath, destination: destPath});
    assert.ok(result.structuredContent.success);
    assert.strictEqual(result.structuredContent.result.source, sourcePath);
    assert.strictEqual(result.structuredContent.result.destination, destPath);
    assert.ok(fs.existsSync(destPath));
  });

  it("should return an InvalidOperationError when copying a directory without recursive flag", async () => {
    const handler = context.getTool("copy_path");
    const sourceDir = path.join(context.sandboxPath, "srcDir");
    fs.mkdirSync(sourceDir);

    const result = await handler({source: sourceDir, destination: "./destDir"});
    assert.ok(!result.structuredContent.success);
    assert.strictEqual(result.structuredContent.error.name, "InvalidOperationError");
  });
});
