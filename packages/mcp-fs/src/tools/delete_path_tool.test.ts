import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import {it} from "vitest";
import {createIsolatedTestSuite} from "../test/test-helper.js";

createIsolatedTestSuite("delete_path", (context) => {
  it("should delete a file and return correct structured output", async () => {
    const handler = context.getTool("delete_path");
    const filePath = path.join(context.sandboxPath, "file.txt");
    fs.writeFileSync(filePath, "content");
    assert.ok(fs.existsSync(filePath));

    const result = await handler({path: filePath});
    assert.ok(result.structuredContent.success);
    assert.strictEqual(result.structuredContent.result.path, filePath);
    assert.ok(!fs.existsSync(filePath));
  });

  it("should return DeleteNonEmptyDirectoryError for a non-empty directory", async () => {
    const handler = context.getTool("delete_path");
    const dirPath = path.join(context.sandboxPath, "dir");
    fs.mkdirSync(dirPath);
    fs.writeFileSync(path.join(dirPath, "file.txt"), "content");

    const result = await handler({path: dirPath, recursive: false});
    assert.ok(!result.structuredContent.success);
    assert.strictEqual(result.structuredContent.error.name, "DeleteNonEmptyDirectoryError");
  });
});
