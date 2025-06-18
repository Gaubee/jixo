import assert from "node:assert";
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
    const structured = result.structuredContent as any;
    assert.strictEqual(structured.error.name, "InvalidRepoError");
    assert.ok(structured.error.message.includes("directory that does not exist"));
  });

  test("`git_log` on an empty repository should return an empty list", async () => {
    const {repoPath} = await setupSandbox().initRepo();
    const handler = getToolHandler("git_log");
    const result = await handler({repoPath});

    assert.strictEqual(result.isError, undefined);
    const structured = result.structuredContent as any;
    assert.strictEqual(structured.success, true);
    assert.deepStrictEqual(structured.commits, []);
  });

  test("`git_checkout` a non-existent branch should fail", async () => {
    const {repoPath} = await setupSandbox().initRepo();
    const handler = getToolHandler("git_checkout");
    const result = await handler({repoPath, branchName: "nonexistent-branch"});

    assert.strictEqual(result.isError, true);
    const structured = result.structuredContent as any;
    assert.ok(structured.error.message.includes("did not match any file(s) known to git"));
  });

  test("`git_add` a non-existent file should fail", async () => {
    const {repoPath} = await setupSandbox().initRepo();
    const handler = getToolHandler("git_add");
    const result = await handler({repoPath, files: ["nonexistent.txt"]});
    assert.strictEqual(result.isError, true);
    const structured = result.structuredContent as any;
    assert.ok(structured.error.message.includes("did not match any files"));
  });
});
