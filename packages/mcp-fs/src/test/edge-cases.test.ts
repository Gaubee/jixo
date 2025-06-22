import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import {afterEach, beforeEach, describe, test} from "node:test";
import {config} from "../fs-utils/config.js";
import {cleanupSandbox, getToolHandler, SANDBOX, setupSandbox} from "./test-helper.js";

describe("MCP Filesystem Tools - Edge Cases", () => {
  beforeEach(() => {
    setupSandbox();
    config.allowedDirectories = [SANDBOX];
  });

  afterEach(() => {
    cleanupSandbox();
    config.allowedDirectories = [];
  });

  test("read_file on non-existent file should fail", async () => {
    const handler = getToolHandler("read_file");
    const result = await handler({path: path.join(SANDBOX, "nonexistent.txt")});
    assert.ok(result.structuredContent.success === false);
    assert.strictEqual(result.structuredContent.error.name, "Error"); // Node.js throws a generic Error for ENOENT
    assert.ok(result.structuredContent.error.message.includes("ENOENT"));
  });

  test("write_file to a directory should fail", async () => {
    const handler = getToolHandler("write_file");
    const result = await handler({path: SANDBOX, content: "test"});
    assert.ok(result.structuredContent.success === false);
    assert.strictEqual(result.structuredContent.error.name, "InvalidOperationError");
  });

  test("list_directory on a file should fail", async () => {
    const filePath = path.join(SANDBOX, "file.txt");
    fs.writeFileSync(filePath, "content");
    const handler = getToolHandler("list_directory");
    const result = await handler({path: filePath});
    assert.ok(result.structuredContent.success === false, "Expected operation to fail");
    assert.strictEqual(result.structuredContent.error.name, "Error"); // Node.js throws ENOTDIR
    assert.ok(result.structuredContent.error.message.includes("ENOTDIR"), `Expected ENOTDIR error, but got: ${result.structuredContent.error.message}`);
  });

  test("delete_path on a non-existent file should succeed (idempotency)", async () => {
    const handler = getToolHandler("delete_path");
    const result = await handler({path: path.join(SANDBOX, "nonexistent.txt")});
    assert.ok(result.structuredContent.success === true);
    assert.ok(result.structuredContent.result.message?.includes("Successfully deleted"));
  });

  test("search_files in an empty directory should return no matches", async () => {
    const handler = getToolHandler("search_files");
    const result = await handler({path: SANDBOX, pattern: "any"});
    assert.ok(result.structuredContent.success);
    assert.strictEqual(result.structuredContent.result.matches.length, 0);
  });

  test("copy_path a file onto itself should fail", async () => {
    const filePath = path.join(SANDBOX, "file.txt");
    fs.writeFileSync(filePath, "content");
    const handler = getToolHandler("copy_path");
    const result = await handler({source: filePath, destination: filePath});
    assert.ok(result.structuredContent.success === false);
    assert.strictEqual(result.structuredContent.error.name, "InvalidOperationError", "Expected an InvalidOperationError for same source and destination");
  });
});
