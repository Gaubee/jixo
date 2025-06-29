import assert from "node:assert";
import path from "node:path";
import {describe, test} from "vitest";
import {createIsolatedTestSuite} from "./test-helper.js";

createIsolatedTestSuite("Sandbox Security", (context) => {
  describe("Security Validation", () => {
    test("should deny access outside of the sandbox", async () => {
      const readFile = context.getTool("read_file");
      const forbiddenPath = path.resolve(context.sandboxPath, "../../forbidden.txt");
      const result = await readFile({path: forbiddenPath});
      assert.strictEqual(result.structuredContent.success, false, "Operation should have failed");
      assert.strictEqual(result.structuredContent.error.name, "PathNotMountedError", "Should throw PathNotMountedError");
    });
  });
});
