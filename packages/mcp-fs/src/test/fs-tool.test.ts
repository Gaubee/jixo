import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import {afterEach, beforeEach, describe, mock, test} from "node:test";
import {config} from "../fs-utils/config.js";
import {cleanupSandbox, getToolHandler, SANDBOX, setupSandbox} from "./test-helper.js";

describe("MCP Filesystem Tool Handlers", () => {
  beforeEach(() => {
    setupSandbox();
    config.allowedDirectories = [SANDBOX];
  });

  afterEach(() => {
    cleanupSandbox();
    config.allowedDirectories = [];
    mock.restoreAll();
  });

  describe("Security Validation", () => {
    test("should deny access outside of the sandbox", async () => {
      const outsidePath = path.resolve(SANDBOX, "..", "forbidden.txt");
      const handler = getToolHandler("read_file");
      const result = await handler({path: outsidePath});

      assert.ok(result.structuredContent.success === false, "Operation should fail");
      assert.strictEqual(result.structuredContent.error.name, "AccessDeniedError");
    });
  });

  describe("read_file", () => {
    test("should read a file successfully", async () => {
      const testPath = path.join(SANDBOX, "read.txt");
      fs.writeFileSync(testPath, "hello world");
      const handler = getToolHandler("read_file");
      const result = await handler({path: testPath});

      assert.ok(result.structuredContent.success);
      assert.strictEqual(result.structuredContent.result.content, "hello world");
    });
  });

  describe("write_file", () => {
    test("should write a new file", async () => {
      const testPath = path.join(SANDBOX, "write.txt");
      const handler = getToolHandler("write_file");
      await handler({path: testPath, content: "new content"});

      assert.strictEqual(fs.readFileSync(testPath, "utf-8"), "new content");
    });
  });

  describe("edit_file", () => {
    test("should apply edits and return a diff", async () => {
      const testPath = path.join(SANDBOX, "edit.txt");
      fs.writeFileSync(testPath, "original line");
      const handler = getToolHandler("edit_file");
      const result = await handler({
        path: testPath,
        edits: [{oldText: "original", newText: "modified"}],
      });

      assert.ok(result.structuredContent.success);
      assert.strictEqual(result.structuredContent.result.changesApplied, true);
      assert.ok(result.structuredContent.result.diff?.includes("-original line"));
      assert.ok(result.structuredContent.result.diff?.includes("+modified line"));
      assert.strictEqual(fs.readFileSync(testPath, "utf-8"), "modified line");
    });

    test("should return EditConflictError on mismatch", async () => {
      const testPath = path.join(SANDBOX, "edit_conflict.txt");
      fs.writeFileSync(testPath, "actual content");
      const handler = getToolHandler("edit_file");
      const result = await handler({
        path: testPath,
        edits: [{oldText: "expected content", newText: "new"}],
      });
      assert.ok(result.structuredContent.success === false);
      assert.strictEqual(result.structuredContent.error.name, "EditConflictError");
    });
  });

  describe("list_directory", () => {
    test("should list directory contents", async () => {
      fs.writeFileSync(path.join(SANDBOX, "file.txt"), "");
      fs.mkdirSync(path.join(SANDBOX, "subdir"));
      const handler = getToolHandler("list_directory");
      const result = await handler({path: SANDBOX});

      assert.ok(result.structuredContent.success);
      const names = result.structuredContent.result.entries.map((e) => e.name).sort();
      assert.deepStrictEqual(names, ["file.txt", "subdir"]);
    });

    test("should list recursively with correct structure", async () => {
      const subdir = path.join(SANDBOX, "subdir");
      fs.mkdirSync(subdir);
      fs.writeFileSync(path.join(subdir, "nested.txt"), "");
      const handler = getToolHandler("list_directory");
      const result = await handler({path: SANDBOX, maxDepth: 2});

      assert.ok(result.structuredContent.success);
      const subdirEntry = result.structuredContent.result.entries.find((e) => e.name === "subdir");
      assert.ok(subdirEntry);
      assert.strictEqual(subdirEntry.type, "directory");
      assert.strictEqual(subdirEntry.children?.[0]?.name, "nested.txt");
    });
  });

  describe("delete_path", () => {
    test("should delete a file", async () => {
      const testPath = path.join(SANDBOX, "delete.txt");
      fs.writeFileSync(testPath, "content");
      const handler = getToolHandler("delete_path");
      await handler({path: testPath});
      assert.strictEqual(fs.existsSync(testPath), false);
    });

    test("should fail to delete non-empty directory without recursive flag", async () => {
      const testDir = path.join(SANDBOX, "delete_dir");
      fs.mkdirSync(testDir);
      fs.writeFileSync(path.join(testDir, "file.txt"), "content");
      const handler = getToolHandler("delete_path");
      const result = await handler({path: testDir, recursive: false});

      assert.ok(result.structuredContent.success === false);
      assert.strictEqual(result.structuredContent.error.name, "DeleteNonEmptyDirectoryError");
      assert.ok(fs.existsSync(testDir));
    });

    test("should delete non-empty directory with recursive flag", async () => {
      const testDir = path.join(SANDBOX, "delete_dir_rec");
      fs.mkdirSync(testDir);
      fs.writeFileSync(path.join(testDir, "file.txt"), "content");
      const handler = getToolHandler("delete_path");
      await handler({path: testDir, recursive: true});
      assert.strictEqual(fs.existsSync(testDir), false);
    });
  });
});
