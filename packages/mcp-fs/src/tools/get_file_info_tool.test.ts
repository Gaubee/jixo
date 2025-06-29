import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import {it} from "vitest";
import {createIsolatedTestSuite} from "../test/test-helper.js";

createIsolatedTestSuite("get_file_info", (context) => {
  it("should return correct structured output for a file", async () => {
    const handler = context.getTool("get_file_info");
    const filePath = path.join(context.sandboxPath, "info.txt");
    fs.writeFileSync(filePath, "content");
    const stats = fs.statSync(filePath);

    const result = await handler({path: filePath});
    assert.ok(result.structuredContent.success);
    const resultData = result.structuredContent.result;
    assert.strictEqual(resultData.path, filePath);
    assert.strictEqual(resultData.type, "file");
    assert.strictEqual(resultData.size, stats.size);
    assert.strictEqual(resultData.created, stats.birthtime.toISOString());
    assert.strictEqual(resultData.modified, stats.mtime.toISOString());
    assert.ok(typeof resultData.permissions === "string" && resultData.permissions.length > 0);
  });

  it("should return a structured FileNotFoundError", async () => {
    const handler = context.getTool("get_file_info");
    const nonExistentPath = path.join(context.sandboxPath, "nonexistent.txt");

    const result = await handler({path: nonExistentPath});
    assert.ok(!result.structuredContent.success);

    const errorData = result.structuredContent.error;
    assert.strictEqual(errorData.name, "FileNotFoundError");
    assert.ok(errorData.message.includes("not found at path"), "Error message should indicate the file was not found.");
    assert.deepStrictEqual(errorData.remedy_tool_suggestions, [
      {
        tool_name: "list_directory",
        description: "The file or directory was not found. Use 'list_directory' on the parent directory to check if the path is correct.",
      },
    ]);
  });
});
