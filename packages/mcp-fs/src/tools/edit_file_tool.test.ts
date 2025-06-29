import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import {it} from "vitest";
import {createIsolatedTestSuite} from "../test/test-helper.js";

createIsolatedTestSuite("edit_file", (context) => {
  it("should apply edits and return correct structured output", async () => {
    const handler = context.getTool("edit_file");
    const filePath = path.join(context.sandboxPath, "edit.txt");
    fs.writeFileSync(filePath, "version = 1");

    // Test with 'diff' return style
    const resultDiff = await handler({path: filePath, edits: [{oldText: "1", newText: "2"}], returnStyle: "diff"});
    assert.ok(resultDiff.structuredContent.success, "Edit with diff should succeed");
    const diffData = resultDiff.structuredContent.result;
    assert.strictEqual(diffData.path, filePath);
    assert.strictEqual(diffData.changesApplied, true);
    assert.ok(diffData.diff?.includes("-version = 1"), "Diff should contain old version");
    assert.ok(diffData.diff?.includes("+version = 2"), "Diff should contain new version");
    assert.strictEqual(diffData.newContent, undefined, "New content should be undefined for diff style");

    // Test with 'full' return style
    const resultFull = await handler({path: filePath, edits: [{oldText: "2", newText: "3"}], returnStyle: "full"});
    assert.ok(resultFull.structuredContent.success, "Edit with full return should succeed");
    const fullData = resultFull.structuredContent.result;
    assert.strictEqual(fullData.path, filePath);
    assert.strictEqual(fullData.changesApplied, true);
    assert.strictEqual(fullData.newContent, "version = 3");
    assert.ok(fullData.diff, "Diff property should still be present");
  });
});
