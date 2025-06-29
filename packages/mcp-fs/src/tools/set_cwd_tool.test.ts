import assert from "node:assert";
import path from "node:path";
import fs from "node:fs";
import {it} from "vitest";
import {createIsolatedTestSuite} from "../test/test-helper.js";

createIsolatedTestSuite("set_cwd", (context) => {
  it("should set the CWD and return correct structured output", async () => {
    const handler = context.getTool("set_cwd");
    const newCwd = path.join(context.sandboxPath, "new-cwd");
    fs.mkdirSync(newCwd);

    const result = await handler({path: newCwd});
    assert.ok(result.structuredContent.success);
    assert.deepStrictEqual(result.structuredContent.result, {
      newCwd: newCwd,
      message: `Current working directory changed to: ${newCwd}`,
    });
  });

  it("should return FileNotFoundError if path does not exist", async () => {
    const handler = context.getTool("set_cwd");
    const result = await handler({path: "./nonexistent"});
    assert.ok(!result.structuredContent.success);
    assert.strictEqual(result.structuredContent.error.name, "FileNotFoundError");
  });
});
