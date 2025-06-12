import type {CallToolResult} from "@modelcontextprotocol/sdk/types.js";
import assert from "node:assert";
import fs from "node:fs/promises";
import {afterEach, beforeEach, describe, mock, test} from "node:test";
import {PnpmExecutionError, pnpmApi} from "../index.js";

// Helper to get a tool's handler function for testing.
function getToolHandler(toolName: keyof typeof pnpmApi.tools) {
  const tool = pnpmApi.tools[toolName];
  if (!tool) throw new Error(`Tool definition for "${toolName}" not found.`);
  // @ts-ignore - The 'extra' parameter is not needed for these tests.
  return (args: any): Promise<CallToolResult> => tool.callback(args, {} as any);
}

describe("Tool Output and Error Handling", () => {
  // Mock fs.readFile for the 'run' tool security check.
  beforeEach(() => {
    mock.method(fs, "readFile", async (path: string) => {
      if (path.endsWith("package.json")) {
        return JSON.stringify({
          scripts: {
            build: 'echo "building..."',
          },
        });
      }
      throw new Error(`readFile mock: unhandled path ${path}`);
    });
  });

  afterEach(() => {
    mock.restoreAll();
  });

  describe("`install` tool", () => {
    test("should return structured content on success", async () => {
      const mockResult = {stdout: "Install complete.", stderr: "warning: peer dep missing", exitCode: 0};
      mock.method(pnpmApi.helpers, "executePnpmCommand", async () => mockResult);
      const handler = getToolHandler("install");
      const result = await handler({frozenLockfile: true});

      assert.strictEqual(result.isError, undefined, "isError should be undefined on success");
      assert.ok(result.structuredContent, "structuredContent should exist on success");
      assert.deepStrictEqual(result.structuredContent, {
        success: true,
        ...mockResult,
      });
    });

    test("should return a structured error on PnpmExecutionError", async () => {
      const error = new PnpmExecutionError("Install failed", "...", "Missing peer dependency", 1);
      mock.method(pnpmApi.helpers, "executePnpmCommand", async () => {
        throw error;
      });
      const handler = getToolHandler("install");
      const result = await handler({});

      assert.strictEqual(result.isError, true, "isError should be true on failure");
      assert.ok(result.structuredContent, "structuredContent should exist on failure");
      const structured = result.structuredContent as any;
      assert.strictEqual(structured.success, false);
      assert.strictEqual(structured.exitCode, 1);
      assert.strictEqual(structured.stdout, "...");
      assert.strictEqual(structured.stderr, "Missing peer dependency");
      assert.strictEqual(structured.error.name, "PnpmExecutionError");
      assert.strictEqual(structured.error.message, "Install failed");
    });
  });

  describe("`run` tool", () => {
    test("should return a structured error if script does not exist", async () => {
      // No need to mock executePnpmCommand as it shouldn't be called.
      const handler = getToolHandler("run");
      const result = await handler({script: "nonexistent-script"});

      assert.strictEqual(result.isError, true);
      assert.ok(result.structuredContent, "structuredContent should exist on security check failure");
      const structured = result.structuredContent as any;
      assert.strictEqual(structured.success, false);
      assert.strictEqual(structured.error.name, "Error");
      assert.ok(structured.error.message.includes('Script "nonexistent-script" not found'));
    });
  });

  describe("`licenses` tool", () => {
    test("should return structured JSON entries on success", async () => {
      const licenseData = [{name: "zod", license: "MIT"}];
      const mockResult = {stdout: JSON.stringify(licenseData), stderr: "", exitCode: 0};
      mock.method(pnpmApi.helpers, "executePnpmCommand", async () => mockResult);
      const handler = getToolHandler("licenses");
      const result = await handler({json: true});

      assert.strictEqual(result.isError, undefined);
      assert.ok(result.structuredContent);
      assert.deepStrictEqual(result.structuredContent, {
        success: true,
        ...mockResult,
        entries: licenseData,
      });
    });

    test("should return a structured error if JSON parsing fails", async () => {
      const mockResult = {stdout: "{invalid json}", stderr: "", exitCode: 0};
      mock.method(pnpmApi.helpers, "executePnpmCommand", async () => mockResult);
      const handler = getToolHandler("licenses");
      const result = await handler({json: true});

      assert.strictEqual(result.isError, true);
      assert.ok(result.structuredContent);
      const structured = result.structuredContent as any;
      assert.strictEqual(structured.success, false);
      assert.strictEqual(structured.error.name, "Error");
      assert.ok(structured.error.message.includes("Failed to parse JSON output"));
    });
  });
});

describe("MCP pnpm Tool Command Argument Generation", () => {
  let lastCall: {args: string[] | null; cwd: string | undefined};

  beforeEach(() => {
    lastCall = {args: null, cwd: undefined};
    // This mock captures the arguments for verification.
    mock.method(pnpmApi.helpers, "executePnpmCommand", async (args: string[], cwd?: string) => {
      lastCall = {args, cwd};
      return {stdout: "mocked", stderr: "", exitCode: 0};
    });
    // This mock handles the security check in the 'run' tool.
    mock.method(fs, "readFile", async () => JSON.stringify({scripts: {build: "...", test: "..."}}));
  });

  afterEach(() => {
    mock.restoreAll();
  });

  test("`install` should combine all options correctly", async () => {
    const handler = getToolHandler("install");
    await handler({
      cwd: "./backend",
      production: true,
      extraArgs: ["--ignore-scripts"],
    });
    assert.deepStrictEqual(lastCall.args, ["install", "--prod", "--ignore-scripts"]);
    assert.strictEqual(lastCall.cwd, "./backend");
  });

  test("`add` should handle dev, optional, and filter flags", async () => {
    const handler = getToolHandler("add");
    await handler({
      packages: ["eslint"],
      dev: true,
      optional: true,
      filter: "my-app",
    });
    assert.deepStrictEqual(lastCall.args, ["--filter", "my-app", "add", "-D", "-O", "eslint"]);
  });

  test("`run` should combine script args and extraArgs", async () => {
    const handler = getToolHandler("run");
    await handler({
      script: "test",
      scriptArgs: ["--ci", "--coverage"],
      extraArgs: ["--stream"],
    });
    assert.deepStrictEqual(lastCall.args, ["run", "test", "--stream", "--", "--ci", "--coverage"]);
  });

  test("`dlx` should handle command and args correctly", async () => {
    const handler = getToolHandler("dlx");
    await handler({
      commandAndArgs: ["cowsay", "Hello MCP!"],
      extraArgs: ["--quiet"],
      cwd: "/tmp/test",
    });
    assert.deepStrictEqual(lastCall.args, ["dlx", "--quiet", "cowsay", "Hello MCP!"]);
    assert.strictEqual(lastCall.cwd, "/tmp/test");
  });

  test("`create` should handle template and args correctly", async () => {
    const handler = getToolHandler("create");
    await handler({
      template: "vite@latest",
      templateArgs: ["my-app", "--template", "react-ts"],
      extraArgs: ["--force"],
    });
    assert.deepStrictEqual(lastCall.args, ["create", "vite@latest", "my-app", "--template", "react-ts", "--force"]);
  });
});
