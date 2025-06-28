import assert from "node:assert";
import path from "node:path";
import {afterEach, beforeEach, describe, test} from "node:test";
import {cleanupSandbox, getToolHandler, SANDBOX, setupSandbox} from "./test-helper.js";

describe("MCP Filesystem Tool Handlers", () => {
  describe("Security Validation", () => {
    beforeEach(() => {
      setupSandbox();
    });

    afterEach(() => {
      cleanupSandbox();
    });
    test("should deny access outside of the sandbox", async () => {
      const readFile = getToolHandler("read_file");
      const forbiddenPath = path.resolve(SANDBOX, "../../forbidden.txt");
      const result = await readFile({path: forbiddenPath});
      assert.strictEqual(result.structuredContent.success, false, "Operation should have failed");
      assert.strictEqual(result.structuredContent.error.name, "PathNotMountedError", "Should throw PathNotMountedError");
    });
  });

  // Other test suites from the original file remain unchanged.
  // ...
});
