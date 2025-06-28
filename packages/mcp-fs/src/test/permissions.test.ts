import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import {afterEach, beforeEach, describe, test} from "node:test";
import {state} from "../state.js";
import {readOnlyPermissions, readwritePermissions} from "../types.js";
import {cleanupSandbox, getToolHandler, SANDBOX} from "./test-helper.js";

const MOUNT_READONLY = path.join(SANDBOX, "readonly");
const MOUNT_READWRITE = path.join(SANDBOX, "readwrite");
const MOUNT_NESTED_READWRITE = path.join(MOUNT_READONLY, "nested-rw");

describe("Complex Permissions", () => {
  beforeEach(() => {
    // Manually setup sandbox and state for this specific suite
    cleanupSandbox();
    fs.mkdirSync(SANDBOX, {recursive: true});
    fs.mkdirSync(MOUNT_READONLY, {recursive: true});
    fs.mkdirSync(MOUNT_READWRITE, {recursive: true});
    fs.mkdirSync(MOUNT_NESTED_READWRITE, {recursive: true});

    state.mountPoints = [
      {rawPath: MOUNT_NESTED_READWRITE, realPath: MOUNT_NESTED_READWRITE, permissions: readwritePermissions, drive: "C"},
      {rawPath: MOUNT_READONLY, realPath: MOUNT_READONLY, permissions: readOnlyPermissions, drive: "A"},
      {rawPath: MOUNT_READWRITE, realPath: MOUNT_READWRITE, permissions: readwritePermissions, drive: "B"},
    ].sort((a, b) => b.realPath.length - a.realPath.length);

    state.cwd = SANDBOX;
  });

  afterEach(() => {
    cleanupSandbox();
  });

  test("should deny writing to a read-only parent mount", async () => {
    const writeFile = getToolHandler("write_file");
    const filePath = path.join(MOUNT_READONLY, "file.txt");
    const result = await writeFile({path: filePath, content: "test"});

    assert.ok(!result.structuredContent.success);
    assert.strictEqual(result.structuredContent.error.name, "PermissionDeniedError");
  });

  test("should allow writing to a read-write nested mount", async () => {
    const writeFile = getToolHandler("write_file");
    const filePath = path.join(MOUNT_NESTED_READWRITE, "file.txt");
    const result = await writeFile({path: filePath, content: "test"});

    assert.ok(result.structuredContent.success, `Write failed: ${JSON.stringify(result.structuredContent)}`);
  });

  test("should deny moving a file into a read-only mount", async () => {
    const moveFile = getToolHandler("move_file");
    const sourcePath = path.join(MOUNT_READWRITE, "source.txt");
    const destPath = path.join(MOUNT_READONLY, "dest.txt");
    fs.writeFileSync(sourcePath, "content");

    const result = await moveFile({source: sourcePath, destination: destPath});
    assert.ok(!result.structuredContent.success);
    assert.strictEqual(result.structuredContent.error.name, "PermissionDeniedError");
  });

  test("should allow copying from a read-only mount to a read-write mount", async () => {
    const copyPath = getToolHandler("copy_path");
    const sourcePath = path.join(MOUNT_READONLY, "source.txt");
    const destPath = path.join(MOUNT_READWRITE, "dest.txt");
    fs.writeFileSync(sourcePath, "content");

    const result = await copyPath({source: sourcePath, destination: destPath});
    assert.ok(result.structuredContent.success, `Copy failed: ${JSON.stringify(result.structuredContent)}`);
    assert.ok(fs.existsSync(destPath));
  });
});
