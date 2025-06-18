import type {CallToolResult, TextContent} from "@modelcontextprotocol/sdk/types.js";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {afterEach, beforeEach, describe, mock, test} from "node:test";
import {simpleGit} from "simple-git";
import {z} from "zod";
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

describe("MCP Git Tool Handlers (Integration)", () => {
  const TEST_REPO_PATH = path.join(SANDBOX, "test_repo");

  beforeEach(async () => {
    mock.restoreAll(); // Ensure no mocks leak between tests
    fs.rmSync(SANDBOX, {recursive: true, force: true});
    fs.mkdirSync(SANDBOX, {recursive: true});

    // Setup a real git repository for most tests
    await GitWrapper.init(TEST_REPO_PATH);
    const git = simpleGit(TEST_REPO_PATH);
    fs.writeFileSync(path.join(TEST_REPO_PATH, "test.txt"), "initial content");
    await git.add("test.txt");
    await git.commit("initial commit");
  });

  afterEach(() => {
    fs.rmSync(SANDBOX, {recursive: true, force: true});
  });

  describe("`git_status` tool", () => {
    test("should return structured content on success", async () => {
      const handler = getToolHandler("git_status");
      fs.writeFileSync(path.join(TEST_REPO_PATH, "untracked.txt"), "untracked");
      fs.appendFileSync(path.join(TEST_REPO_PATH, "test.txt"), "\nmodified");

      const result = await handler({repoPath: TEST_REPO_PATH});

      assert.strictEqual(result.isError, undefined, "Result should not be an error");
      const structured = result.structuredContent as any;
      assert.strictEqual(structured.success, true);
      assert.strictEqual(structured.current, "main");
      assert.strictEqual(structured.isClean(), false);
      assert.strictEqual(structured.files.length, 2);
      assert.ok(structured.files.some((f: any) => f.path === "test.txt" && f.working_dir === "M"));
      assert.ok(structured.files.some((f: any) => f.path === "untracked.txt" && f.working_dir === "?"));

      const textOutput = getResultText(result);
      assert.ok(textOutput.includes("On branch main"));
      assert.ok(textOutput.includes("Changes not staged for commit:"));
      assert.ok(textOutput.includes("\tmodified:   test.txt"));
      assert.ok(textOutput.includes("Untracked files:"));
      assert.ok(textOutput.includes("\tuntracked.txt"));
    });

    test("should return a structured error for invalid repo path", async () => {
      const handler = getToolHandler("git_status");
      const nonRepoPath = path.join(SANDBOX, "not-a-repo");
      fs.mkdirSync(nonRepoPath);
      const result = await handler({repoPath: nonRepoPath});

      assert.strictEqual(result.isError, true, "Result should be an error");
      const structured = result.structuredContent as any;
      assert.strictEqual(structured.success, false);
      assert.strictEqual(structured.error.name, "InvalidRepoError");
    });
  });

  describe("`git_commit` tool", () => {
    test("should return structured success message with hash", async () => {
      const handler = getToolHandler("git_commit");
      fs.writeFileSync(path.join(TEST_REPO_PATH, "new-file.txt"), "some data");
      await simpleGit(TEST_REPO_PATH).add("new-file.txt");

      const result = await handler({repoPath: TEST_REPO_PATH, message: "feat: add new feature"});
      assert.strictEqual(result.isError, undefined);

      const structured = result.structuredContent as any;
      assert.strictEqual(structured.success, true);
      assert.ok(structured.commitHash.length > 0, "Commit hash should be present");
      assert.ok(structured.message.includes(structured.commitHash), "Message should contain the hash");
    });
  });

  describe("`git_log` tool", () => {
    test("should return a structured list of commits", async () => {
      const git = simpleGit(TEST_REPO_PATH);
      fs.writeFileSync(path.join(TEST_REPO_PATH, "log-test.txt"), "data");
      await git.add("log-test.txt");
      const secondCommit = await git.commit("second commit");

      const handler = getToolHandler("git_log");
      const result = await handler({repoPath: TEST_REPO_PATH});

      assert.strictEqual(result.isError, undefined);
      const structured = result.structuredContent as any;
      assert.strictEqual(structured.success, true);
      assert.strictEqual(structured.commits.length, 2);
      assert.strictEqual(structured.commits[0].hash, secondCommit.commit);
      assert.strictEqual(structured.commits[0].message.trim(), "second commit");
      assert.strictEqual(structured.commits[1].message.trim(), "initial commit");

      const textOutput = getResultText(result);
      assert.ok(textOutput.includes(structured.commits[0].hash));
      assert.ok(textOutput.includes(structured.commits[1].hash));
    });
  });

  describe("`git_init` tool", () => {
    test("should initialize a new repository", async () => {
      const handler = getToolHandler("git_init");
      const newRepoPath = path.join(SANDBOX, "new_repo");
      const result = await handler({repoPath: newRepoPath});
      assert.strictEqual(result.isError, undefined);
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
      const currentBranch = await git.revparse(["--abbrev-ref", "HEAD"]);
      assert.strictEqual(currentBranch, "test-branch");
    });
  });
});
