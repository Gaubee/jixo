import assert from "node:assert";
import path from "node:path";
import {afterEach, beforeEach, describe, test} from "node:test";
import {PathNotMountedError, PermissionDeniedError} from "../error.js";
import {resolveAndValidatePath} from "../fs-utils/resolve-and-validate-path.js";
import {state} from "../state.js";
import {readOnlyPermissions, readwritePermissions} from "../types.js";

const MOUNT_A = path.resolve("./test-mount-a");
const MOUNT_B = path.resolve("./test-mount-b");
const MOUNT_A_NESTED = path.resolve(MOUNT_A, "nested");

describe("resolveAndValidatePath", () => {
  beforeEach(() => {
    // Reset state before each test
    state.mountPoints = [
      {rawPath: MOUNT_B, realPath: MOUNT_B, permissions: readOnlyPermissions, drive: "B"},
      {rawPath: MOUNT_A_NESTED, realPath: MOUNT_A_NESTED, permissions: readwritePermissions, drive: "C"},
      {rawPath: MOUNT_A, realPath: MOUNT_A, permissions: readwritePermissions, drive: "A"},
    ].sort((a, b) => b.realPath.length - a.realPath.length); // Ensure correct sort order

    state.cwd = MOUNT_A;
  });

  afterEach(() => {
    state.mountPoints = [];
    state.cwd = "";
  });

  describe("Path Resolution", () => {
    test("should resolve an absolute path within a mount", () => {
      const filePath = path.join(MOUNT_A, "file.txt");
      const {validatedPath} = resolveAndValidatePath(filePath, "read");
      assert.strictEqual(validatedPath, filePath);
    });

    test("should resolve a relative path from CWD", () => {
      const {validatedPath} = resolveAndValidatePath("file.txt", "read");
      assert.strictEqual(validatedPath, path.join(MOUNT_A, "file.txt"));
    });

    test("should resolve a relative path with '../'", () => {
      state.cwd = MOUNT_A_NESTED;
      const {validatedPath} = resolveAndValidatePath("../other.txt", "read");
      assert.strictEqual(validatedPath, path.join(MOUNT_A, "other.txt"));
    });

    test("should resolve a drive letter path", () => {
      const {validatedPath} = resolveAndValidatePath("$B/config.json", "read");
      assert.strictEqual(validatedPath, path.join(MOUNT_B, "config.json"));
    });

    test("should throw if drive letter is not found", () => {
      assert.throws(() => resolveAndValidatePath("$Z/file.txt", "read"), PathNotMountedError);
    });
  });

  describe("Permission Validation", () => {
    test("should allow read from a read-only mount", () => {
      assert.doesNotThrow(() => resolveAndValidatePath("$B/file.txt", "read"));
    });

    test("should deny write to a read-only mount", () => {
      assert.throws(() => resolveAndValidatePath("$B/file.txt", "write"), PermissionDeniedError);
    });

    test("should allow read and write to a read-write mount", () => {
      assert.doesNotThrow(() => resolveAndValidatePath("$A/file.txt", "read"));
      assert.doesNotThrow(() => resolveAndValidatePath("$A/file.txt", "write"));
    });
  });

  describe("Mount Point Specificity", () => {
    test("should use the most specific (longest path) mount point", () => {
      const nestedPath = path.join(MOUNT_A_NESTED, "deep.txt");
      const {mountPoint} = resolveAndValidatePath(nestedPath, "read");
      assert.strictEqual(mountPoint.drive, "C");
      assert.strictEqual(mountPoint.permissions, readwritePermissions);
    });

    test("should use the parent mount point for paths outside the nested one", () => {
      const siblingPath = path.join(MOUNT_A, "sibling.txt");
      const {mountPoint} = resolveAndValidatePath(siblingPath, "read");
      assert.strictEqual(mountPoint.drive, "A");
    });
  });

  describe("Error Handling", () => {
    test("should throw PathNotMountedError for path outside all mounts", () => {
      const outsidePath = path.resolve("./outside.txt");
      assert.throws(() => resolveAndValidatePath(outsidePath, "read"), PathNotMountedError);
    });
  });
});
