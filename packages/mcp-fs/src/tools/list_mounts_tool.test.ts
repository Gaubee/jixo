import assert from "node:assert";
import {it} from "vitest";
import {createIsolatedTestSuite} from "../test/test-helper.js";

createIsolatedTestSuite("list_mounts", (context) => {
  it("should return correct structured output for mounts and CWD", async () => {
    const handler = context.getTool("list_mounts");
    const result = await handler({});
    assert.ok(result.structuredContent.success);
    const resultData = result.structuredContent.result;
    assert.strictEqual(resultData.cwd, context.sandboxPath);
    assert.deepStrictEqual(resultData.mounts, [
      {
        drive: "$A",
        path: context.sandboxPath,
        permissions: "RW",
      },
    ]);
  });
});
