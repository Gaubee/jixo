import assert from "node:assert";
import fs from "node:fs";
import {afterEach, beforeEach, describe, mock, test} from "node:test";
import {cleanupSandbox, getToolHandler, setupSandbox} from "./test-helper.js";

describe("MCP Git Tools - Edge Cases", () => {
  let sandboxPath: string;

  beforeEach(async () => {
    mock.restoreAll();
    const setup = setupSandbox();
    sandboxPath = setup.sandboxPath;
  });

  afterEach(() => {
    cleanupSandbox(sandboxPath);
  });

  test("`git_status` on non-existent path should fail gracefully", async () => {
    const handler = getToolHandler("git_status");
    const result = await handler({repoPath: "/path/to/non/existent/repo"});
    assert.strictEqual(result.isError, true);
    const structured = result.structuredContent;
    assert.ok(structured.error);
    assert.strictEqual(structured.error.name, "InvalidRepoError");
  });

  test("`git_log` on an empty repository should return an empty list", async () => {
    const {repoPath} = await setupSandbox().initRepo();
    const handler = getToolHandler("git_log");
    const result = await handler({repoPath});
    assert.strictEqual(result.isError, undefined);
    const structured = result.structuredContent;
    assert.deepStrictEqual(structured.commits, []);
  });

  test("`git_checkout` a non-existent branch should fail", async () => {
    const {repoPath} = await setupSandbox().initRepo();
    const handler = getToolHandler("git_checkout");
    const result = await handler({repoPath, branchName: "nonexistent-branch"});
    assert.strictEqual(result.isError, true);
  });

  test("`git_add` a non-existent file should fail", async () => {
    const {repoPath} = await setupSandbox().initRepo();
    const handler = getToolHandler("git_add");
    const result = await handler({repoPath, files: ["nonexistent.txt"]});
    assert.strictEqual(result.isError, true);
  });

  test("`git_commit` with no staged changes should fail with a specific error", async () => {
    const {repoPath} = await setupSandbox().initRepo();
    const handler = getToolHandler("git_commit");
    const result = await handler({repoPath, message: "Empty commit"});
    assert.strictEqual(result.isError, true);
    const structured = result.structuredContent;
    assert.ok(structured.error);
    assert.strictEqual(structured.error.name, "EmptyCommitError");
    assert.ok(structured.error.remedy_tool_suggestions);
    assert.ok(structured.error.remedy_tool_suggestions.length > 0);
  });

  test("`git_commit` with a very long message should succeed", async () => {
    const {repoPath, git} = await setupSandbox().initRepo();
    fs.writeFileSync(repoPath + "/file.txt", "content");
    await git.add("file.txt");
    const longMessage = "a".repeat(1024 * 10); // 10KB message
    const handler = getToolHandler("git_commit");
    const result = await handler({repoPath, message: longMessage});
    assert.strictEqual(result.isError, undefined);
    const log = await git.log();
    assert.strictEqual(log.latest?.message, longMessage);
  });

  test("`git_add` with a large number of files should succeed", async () => {
    const {repoPath} = await setupSandbox().initRepo();
    const fileCount = 1000;
    const files = [];
    for (let i = 0; i < fileCount; i++) {
      const fileName = `file-${i}.txt`;
      fs.writeFileSync(`${repoPath}/${fileName}`, `content ${i}`);
      files.push(fileName);
    }
    const handler = getToolHandler("git_add");
    const result = await handler({repoPath, files});
    assert.strictEqual(result.isError, undefined);
  });
});
