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
      const handler = getToolHandler("pnpm_install");
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
      const handler = getToolHandler("pnpm_install");
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
      const handler = getToolHandler("pnpm_run");
      const result = await handler({script: "nonexistent-script"});

      assert.strictEqual(result.isError, true);
      assert.ok(result.structuredContent, "structuredContent should exist on security check failure");
      const structured = result.structuredContent as any;
      assert.strictEqual(structured.success, false);
      assert.strictEqual(structured.error.name, "Error");
      assert.ok(structured.error.message.includes('Script "nonexistent-script" not found'));
    });
  });

  describe("`list` tool", () => {
    test("should return parsed JSON data when --json is used", async () => {
      const listData = [{name: "zod", version: "3.23.8"}];
      const mockResult = {stdout: JSON.stringify(listData), stderr: "", exitCode: 0};
      mock.method(pnpmApi.helpers, "executePnpmCommand", async () => mockResult);
      const handler = getToolHandler("pnpm_list");
      const result = await handler({json: true});

      assert.strictEqual(result.isError, undefined);
      const structured = result.structuredContent as any;
      assert.strictEqual(structured.success, true);
      assert.deepStrictEqual(structured.jsonData, listData);
    });
  });

  describe("`outdated` tool", () => {
    test("should return parsed JSON data when --json is used", async () => {
      const outdatedData = {zod: {current: "3.23.4", latest: "3.23.8"}};
      const mockResult = {stdout: JSON.stringify(outdatedData), stderr: "", exitCode: 0};
      mock.method(pnpmApi.helpers, "executePnpmCommand", async () => mockResult);
      const handler = getToolHandler("pnpm_outdated");
      const result = await handler({json: true});

      assert.strictEqual(result.isError, undefined);
      const structured = result.structuredContent as any;
      assert.strictEqual(structured.success, true);
      assert.deepStrictEqual(structured.jsonData, outdatedData);
    });
  });

  describe("`info` tool", () => {
    test("should return structured JSON data on success", async () => {
      const infoData = {name: "zod", version: "3.23.8"};
      const mockResult = {stdout: JSON.stringify(infoData), stderr: "", exitCode: 0};
      mock.method(pnpmApi.helpers, "executePnpmCommand", async () => mockResult);
      const handler = getToolHandler("pnpm_info");
      const result = await handler({packages: ["zod"], json: true});

      assert.strictEqual(result.isError, undefined);
      assert.ok(result.structuredContent);
      assert.deepStrictEqual(result.structuredContent, {
        success: true,
        stdout: mockResult.stdout,
        stderr: mockResult.stderr,
        exitCode: mockResult.exitCode,
        jsonData: infoData,
      });
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

  test("`install` should handle filter argument", async () => {
    const handler = getToolHandler("pnpm_install");
    await handler({filter: "my-app", frozenLockfile: true});
    assert.deepStrictEqual(lastCall.args, ["--filter", "my-app", "install", "--frozen-lockfile"]);
  });

  test("`add` should handle workspaceRoot argument", async () => {
    const handler = getToolHandler("pnpm_add");
    await handler({packages: ["zod"], workspaceRoot: true});
    assert.deepStrictEqual(lastCall.args, ["add", "-w", "zod"]);
  });

  test("`remove` should construct arguments correctly", async () => {
    const handler = getToolHandler("pnpm_remove");
    await handler({packages: ["zod"], filter: "my-app", dev: true});
    assert.deepStrictEqual(lastCall.args, ["--filter", "my-app", "remove", "-D", "zod"]);
  });

  test("`list` should construct arguments correctly", async () => {
    const handler = getToolHandler("pnpm_list");
    await handler({depth: 2, json: true, dev: true, filter: "my-app"});
    assert.deepStrictEqual(lastCall.args, ["--filter", "my-app", "list", "--depth=2", "--json", "--dev"]);
  });

  test("`outdated` should construct arguments correctly", async () => {
    const handler = getToolHandler("pnpm_outdated");
    await handler({packages: ["zod"], recursive: true, json: true});
    assert.deepStrictEqual(lastCall.args, ["outdated", "zod", "--json", "-r"]);
  });

  test("`update` should construct arguments correctly", async () => {
    const handler = getToolHandler("pnpm_update");
    await handler({packages: ["zod"], latest: true, recursive: true, interactive: true});
    assert.deepStrictEqual(lastCall.args, ["update", "zod", "--latest", "-r", "-i"]);
  });

  test("`run` should combine script args and extraArgs", async () => {
    const handler = getToolHandler("pnpm_run");
    await handler({
      script: "test",
      scriptArgs: ["--ci", "--coverage"],
      extraArgs: ["--stream"],
    });
    assert.deepStrictEqual(lastCall.args, ["run", "test", "--stream", "--", "--ci", "--coverage"]);
  });

  test("`licenses` should handle long argument", async () => {
    const handler = getToolHandler("pnpm_licenses");
    await handler({long: true, json: true, filter: "my-app"});
    assert.deepStrictEqual(lastCall.args, ["--filter", "my-app", "licenses", "list", "--json", "--long"]);
  });

  test("`info` should handle packages, fields, and json flag", async () => {
    const handler = getToolHandler("pnpm_info");
    await handler({
      packages: ["zod"],
      fields: ["version", "license"],
      json: true,
      extraArgs: ["--no-color"],
    });
    assert.deepStrictEqual(lastCall.args, ["info", "zod", "version", "license", "--json", "--no-color"]);
  });
});
