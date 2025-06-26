import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import {afterEach, beforeEach, describe, test} from "node:test";
import {cleanupSandbox, getToolHandler, SANDBOX, setupSandbox} from "./test-helper.js";

describe("MCP Filesystem Tools - Structured Output", () => {
  beforeEach(() => {
    setupSandbox();
  });

  afterEach(() => {
    cleanupSandbox();
  });

  test("read_file returns correct structured output", async () => {
    const handler = getToolHandler("read_file");
    const filePath = path.join(SANDBOX, "read.txt");
    fs.writeFileSync(filePath, "test content");

    const result = await handler({path: filePath});
    assert.ok(result.structuredContent.success);
    assert.deepStrictEqual(result.structuredContent.result, {
      path: filePath,
      content: "test content",
    });
  });

  test("write_file returns correct structured output", async () => {
    const handler = getToolHandler("write_file");
    const filePath = path.join(SANDBOX, "write.txt");
    const result = await handler({path: filePath, content: "test"});

    assert.ok(result.structuredContent.success);
    assert.deepStrictEqual(result.structuredContent.result, {
      path: filePath,
      message: `Successfully wrote to ${filePath}`,
    });
  });

  test("list_directory returns correct structured output", async () => {
    const handler = getToolHandler("list_directory");
    const dirPath = path.join(SANDBOX, "dir");
    const filePath = path.join(dirPath, "file.txt");
    fs.mkdirSync(dirPath);
    fs.writeFileSync(filePath, "");

    const result = await handler({path: SANDBOX, maxDepth: 2});
    assert.ok(result.structuredContent.success);
    assert.deepStrictEqual(result.structuredContent.result.path, SANDBOX);
    assert.deepStrictEqual(result.structuredContent.result.entries, [
      {
        name: "dir",
        type: "directory",
        children: [{name: "file.txt", type: "file"}],
      },
    ]);
  });

  test("get_file_info returns correct structured output", async () => {
    const handler = getToolHandler("get_file_info");
    const filePath = path.join(SANDBOX, "info.txt");
    fs.writeFileSync(filePath, "content");
    const stats = fs.statSync(filePath);

    const result = await handler({path: filePath});
    assert.ok(result.structuredContent.success);
    const resultData = result.structuredContent.result;
    assert.strictEqual(resultData.path, filePath);
    assert.strictEqual(resultData.type, "file");
    assert.strictEqual(resultData.size, stats.size);
    assert.strictEqual(resultData.created, stats.birthtime.toISOString());
  });

  test("copy_path returns correct structured output", async () => {
    const handler = getToolHandler("copy_path");
    const sourcePath = path.join(SANDBOX, "source.txt");
    const destPath = path.join(SANDBOX, "dest.txt");
    fs.writeFileSync(sourcePath, "content");

    const result = await handler({source: sourcePath, destination: destPath});
    assert.ok(result.structuredContent.success);
    assert.strictEqual(result.structuredContent.result.source, sourcePath);
    assert.strictEqual(result.structuredContent.result.destination, destPath);
    assert.ok(result.structuredContent.result.message);
  });

  test("move_file returns correct structured output", async () => {
    const handler = getToolHandler("move_file");
    const sourcePath = path.join(SANDBOX, "source.txt");
    const destPath = path.join(SANDBOX, "dest.txt");
    fs.writeFileSync(sourcePath, "content");

    const result = await handler({source: sourcePath, destination: destPath});
    assert.ok(result.structuredContent.success);
    assert.strictEqual(result.structuredContent.result.source, sourcePath);
    assert.strictEqual(result.structuredContent.result.destination, destPath);
    assert.ok(result.structuredContent.result.message);
  });

  test("delete_path returns correct structured output", async () => {
    const handler = getToolHandler("delete_path");
    const filePath = path.join(SANDBOX, "delete.txt");
    fs.writeFileSync(filePath, "content");

    const result = await handler({path: filePath});
    assert.ok(result.structuredContent.success);
    assert.strictEqual(result.structuredContent.result.path, filePath);
    assert.ok(result.structuredContent.result.message);
  });
});
