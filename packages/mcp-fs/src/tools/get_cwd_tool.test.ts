import assert from "node:assert";
import {it} from "vitest";
import {createIsolatedTestSuite} from "../test/test-helper.js";

createIsolatedTestSuite("get_cwd", (context) => {
  it("should return the current working directory", async () => {
    const handler = context.getTool("get_cwd");
    const result = await handler({});
    assert.ok(result.structuredContent.success);
    assert.deepStrictEqual(result.structuredContent.result, {
      cwd: context.sandboxPath,
    });
  });
});
