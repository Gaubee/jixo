import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import {it} from "vitest";
import {createIsolatedTestSuite} from "../test/test-helper.js";

createIsolatedTestSuite("search_files", (context) => {
  it("should find files and return correct structured output", async () => {
    const handler = context.getTool("search_files");
    const matchPath = path.join(context.sandboxPath, "match.js");
    const noMatchPath = path.join(context.sandboxPath, "other.ts");
    fs.writeFileSync(matchPath, "");
    fs.writeFileSync(noMatchPath, "");

    const result = await handler({path: ".", pattern: "match"});
    assert.ok(result.structuredContent.success);
    const resultData = result.structuredContent.result;
    assert.strictEqual(resultData.path, ".");
    assert.strictEqual(resultData.pattern, "match");
    assert.deepStrictEqual(resultData.matches, [matchPath]);
  });

  it("should return FileNotFoundError if root path does not exist", async () => {
    const handler = context.getTool("search_files");
    const result = await handler({path: "./nonexistent", pattern: "any"});
    assert.ok(!result.structuredContent.success);
    assert.strictEqual(result.structuredContent.error.name, "FileNotFoundError");
  });
});
