import type {CallToolResult, TextContent} from "@modelcontextprotocol/sdk/types.js";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {afterEach, beforeEach, describe, mock, test} from "node:test";
import {simpleGit} from "simple-git";
import {z} from "zod";
import {InvalidRepoError} from "../error.js";
import {GitWrapper} from "../git-wrapper.js";
import * as server from "../server.js";

// Helper to safely get the text from a result's content
function getResultText(result: CallToolResult): string {
  assert.ok(result.content && result.content.length > 0, "Result content should not be empty");
  const firstContent = result.content[0];
  assert.strictEqual(firstContent.type, "text", "Expected content type to be 'text'");
  return (firstContent as TextContent).text;
}

// Helper to get a tool's handler function for testing.
function getToolHandler<T extends keyof typeof server.tools>(toolName: T) {
  const tool = server.tools[toolName];
  if (!tool) throw new Error(`Tool definition for "${toolName}" not found.`);
  // @ts-ignore - The 'extra' parameter is not needed for these tests.
  return (args: z.infer<typeof tool.inputSchema>): Promise<CallToolResult> => tool.callback(args, {} as any);
}

const SANDBOX = path.join(os.tmpdir(), "mcp-git-test-sandbox");

describe("MCP Git Tool Handlers (Unit)", () => {
  beforeEach(() => {
    // For unit tests, we mock the entire wrapper to prevent actual git calls
    mock.method(GitWrapper.prototype, "validateRepo", async () => {});
  });

  afterEach(() => {
    mock.restoreAll();
  });

  describe("`git_status` tool", () => {
    test("should return structured content on success", async (t) => {
      const statusText = "On branch main\nYour branch is up to date with 'origin/main'.\n\nnothing to commit, working tree clean";
      mock.method(GitWrapper.prototype, "status", async () => statusText);

      const handler = getToolHandler("git_status");
      const result = await handler({repoPath: "/fake/repo"});

      assert.strictEqual(result.isError, undefined);
      assert.ok(result.structuredContent, "structuredContent should exist on success");
      assert.deepStrictEqual(result.structuredContent, {
        success: true,
        output: statusText,
      });
      assert.ok(getResultText(result).includes(statusText));
    });

    test("should return a structured error for invalid repo", async (t) => {
      const errorMessage = "Not a git repository";
      mock.method(GitWrapper.prototype, "validateRepo", async () => {
        throw new InvalidRepoError(errorMessage);
      });

      const handler = getToolHandler("git_status");
      const result = await handler({repoPath: "/not/a/repo"});

      assert.strictEqual(result.isError, true);
      assert.ok(getResultText(result).includes(errorMessage));

      assert.ok(result.structuredContent, "structuredContent should exist on error");
      const structured = result.structuredContent as any;
      assert.strictEqual(structured.success, false);
      assert.strictEqual(structured.error.name, "InvalidRepoError");
      assert.ok(structured.error.message.includes("Suggestion:"));
    });
  });

  describe("`git_commit` tool", () => {
    test("should return structured success message", async (t) => {
      const commitMessage = "feat: add new feature";
      const successMessage = "Changes committed successfully with hash 1234567";
      mock.method(GitWrapper.prototype, "commit", async () => successMessage);

      const handler = getToolHandler("git_commit");
      const result = await handler({repoPath: "/fake/repo", message: commitMessage});

      assert.strictEqual(result.isError, undefined);
      assert.ok(result.structuredContent);
      assert.deepStrictEqual(result.structuredContent, {
        success: true,
        message: successMessage,
      });
      assert.strictEqual(getResultText(result), successMessage);
    });
  });
});

describe("MCP Git Tool Handlers (Integration)", () => {
  const TEST_REPO_PATH = path.join(SANDBOX, "test_repo");

  beforeEach(async () => {
    mock.restoreAll(); // Use real implementations
    fs.rmSync(SANDBOX, {recursive: true, force: true});
    fs.mkdirSync(SANDBOX, {recursive: true});

    // Setup a real git repository
    await GitWrapper.init(TEST_REPO_PATH);
    const git = simpleGit(TEST_REPO_PATH);
    fs.writeFileSync(path.join(TEST_REPO_PATH, "test.txt"), "initial content");
    await git.add("test.txt");
    await git.commit("initial commit");
  });

  afterEach(() => {
    fs.rmSync(SANDBOX, {recursive: true, force: true});
  });

  describe("`git_init` tool", () => {
    test("should initialize a new repository", async () => {
      const handler = getToolHandler("git_init");
      const newRepoPath = path.join(SANDBOX, "new_repo");
      assert.strictEqual(fs.existsSync(path.join(newRepoPath, ".git")), false);

      const result = await handler({repoPath: newRepoPath});
      assert.strictEqual(result.isError, undefined);
      assert.ok(getResultText(result).includes("Initialized empty Git repository"));
      assert.ok(fs.existsSync(path.join(newRepoPath, ".git")));
    });
  });

  describe("`git_checkout` tool", () => {
    test("should checkout an existing branch", async () => {
      const git = simpleGit(TEST_REPO_PATH);
      await git.branch(["test-branch"]);

      const handler = getToolHandler("git_checkout");
      const result = await handler({repoPath: TEST_REPO_PATH, branchName: "test-branch"});

      assert.strictEqual(result.isError, undefined);
      assert.ok(getResultText(result).includes("Switched to branch 'test-branch'"));
      const currentBranch = await git.revparse(["--abbrev-ref", "HEAD"]);
      assert.strictEqual(currentBranch, "test-branch");
    });

    test("should fail to checkout a nonexistent branch", async () => {
      const handler = getToolHandler("git_checkout");
      const result = await handler({repoPath: TEST_REPO_PATH, branchName: "nonexistent-branch"});
      assert.ok(result.isError);
      assert.ok(getResultText(result).includes("did not match any file(s) known to git"));
    });
  });
});
