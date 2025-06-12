import type {CallToolResult, TextContent} from "@modelcontextprotocol/sdk/types.js";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import {afterEach, beforeEach, describe, mock, test} from "node:test";
import {z} from "zod";
import {AccessDeniedError, EditConflictError, fsToolApi} from "../index.js";

// Helper to safely get the text from a result's content
function getResultText(result: CallToolResult): string {
  assert.ok(result.content && result.content.length > 0, "Result content should not be empty");
  const firstContent = result.content[0];
  assert.strictEqual(firstContent.type, "text", "Expected content type to be 'text'");
  return (firstContent as TextContent).text;
}

// Helper to get a tool's handler function for testing.
function getToolHandler<T extends keyof typeof fsToolApi.tools>(toolName: T) {
  const tool = fsToolApi.tools[toolName];
  if (!tool) throw new Error(`Tool definition for "${toolName}" not found.`);
  // @ts-ignore - The 'extra' parameter is not needed for these tests.
  return (args: z.infer<typeof tool.inputSchema>): Promise<CallToolResult> => tool.callback(args, {} as any);
}

describe("MCP Filesystem Tool Handlers", () => {
  // Mock the internal helper functions to isolate tool logic for testing.
  beforeEach(() => {
    mock.method(fsToolApi.helpers, "validatePath", async (p: string) => path.resolve(p));
  });

  afterEach(() => {
    mock.restoreAll();
  });

  describe("`read_file` tool", () => {
    test("should return structured content on success", async (t) => {
      // Mock the underlying fs call for this specific test
      mock.method(fs.promises, "readFile", async () => "hello world");
      const handler = getToolHandler("read_file");
      const testPath = "/safe/dir/read_test.txt";
      const result = await handler({path: testPath});

      assert.strictEqual(result.isError, undefined);
      assert.ok(result.structuredContent, "structuredContent should exist on success");
      assert.deepStrictEqual(result.structuredContent, {
        success: true,
        path: path.resolve(testPath),
        content: "hello world",
      });
      assert.strictEqual(getResultText(result), "hello world");
    });

    test("should return a structured error for access denied", async (t) => {
      const errorMessage = "Access Denied";
      mock.method(fsToolApi.helpers, "validatePath", async () => {
        throw new AccessDeniedError(errorMessage);
      });
      const handler = getToolHandler("read_file");
      const result = await handler({path: "/forbidden/path/file.txt"});

      assert.strictEqual(result.isError, true);
      assert.ok(getResultText(result).includes(errorMessage));

      assert.ok(result.structuredContent, "structuredContent should exist on error");
      const structured = result.structuredContent as any;
      assert.strictEqual(structured.success, false);
      assert.strictEqual(structured.error.name, "AccessDeniedError");
      assert.strictEqual(structured.error.message, errorMessage);
    });
  });

  describe("`write_file` tool", () => {
    test("should return structured success message", async (t) => {
      mock.method(fs.promises, "writeFile", async () => {});
      const handler = getToolHandler("write_file");
      const testPath = "/safe/dir/write_test.txt";
      const result = await handler({path: testPath, content: "new content"});

      assert.strictEqual(result.isError, undefined);
      assert.ok(result.structuredContent);
      assert.deepStrictEqual(result.structuredContent, {
        success: true,
        path: path.resolve(testPath),
        message: `Successfully wrote to ${testPath}`,
      });
    });
  });

  describe("`edit_file` tool", () => {
    test("should return a diff and correct structured content", async (t) => {
      mock.method(fsToolApi.helpers, "applyFileEdits", async () => ({
        originalContent: "original",
        modifiedContent: "modified",
      }));
      mock.method(fs.promises, "writeFile", async () => {});

      const handler = getToolHandler("edit_file");
      const testPath = "/safe/dir/edit_test.txt";
      const result = await handler({path: testPath, edits: [{oldText: "o", newText: "m"}]});

      assert.strictEqual(result.isError, undefined);
      assert.ok(result.structuredContent, "structuredContent should exist");
      const structured = result.structuredContent as any;
      assert.strictEqual(structured.success, true);
      assert.strictEqual(structured.changesApplied, true);
      assert.ok(structured.diff?.includes(`--- ${path.resolve(testPath)}`));
    });

    test("should handle EditConflictError with a structured error and suggestion", async (t) => {
      const errorMessage = "Text not found";
      mock.method(fsToolApi.helpers, "applyFileEdits", async () => {
        throw new EditConflictError(errorMessage);
      });

      const handler = getToolHandler("edit_file");
      const testPath = "/safe/dir/conflict_test.txt";
      const result = await handler({path: testPath, edits: [{oldText: "a", newText: "b"}]});

      assert.strictEqual(result.isError, true);
      const errorText = getResultText(result);
      assert.ok(errorText.includes(errorMessage));
      assert.ok(errorText.includes("Suggestion: The file content may have changed"));

      assert.ok(result.structuredContent, "structuredContent should exist on error");
      const structured = result.structuredContent as any;
      assert.strictEqual(structured.success, false);
      assert.strictEqual(structured.error.name, "EditConflictError");
      assert.ok(structured.error.message.includes(errorMessage));
    });
  });

  describe("`list_directory` tool", () => {
    test("should return structured list of entries", async (t) => {
      mock.method(fs.promises, "readdir", async () => [{name: "file.txt", isDirectory: () => false, isFile: () => true}] as any);
      const handler = getToolHandler("list_directory");
      const testPath = "/safe/dir";
      const result = await handler({path: testPath});

      assert.strictEqual(result.isError, undefined);
      assert.ok(result.structuredContent);
      assert.deepStrictEqual(result.structuredContent, {
        success: true,
        path: path.resolve(testPath),
        entries: [{name: "file.txt", type: "file"}],
      });
    });
  });

  describe("`get_file_info` tool", () => {
    test("should return structured file metadata", async (t) => {
      const stats = {
        size: 123,
        birthtime: new Date("2024-01-01Z"),
        mtime: new Date("2024-01-02Z"),
        isDirectory: () => false,
        isFile: () => true,
        mode: 0o100644,
      };
      mock.method(fs.promises, "stat", async () => stats);

      const handler = getToolHandler("get_file_info");
      const testPath = "/safe/dir/info_test.txt";
      const result = await handler({path: testPath});

      assert.strictEqual(result.isError, undefined);
      assert.ok(result.structuredContent);
      const structured = result.structuredContent as any;
      assert.strictEqual(structured.success, true);
      assert.strictEqual(structured.path, path.resolve(testPath));
      assert.strictEqual(structured.size, 123);
      assert.strictEqual(structured.type, "file");
    });
  });

  describe("`list_allowed_directories` tool", () => {
    test("should return structured list of allowed directories", async () => {
      // Set some directories for the test
      fsToolApi.allowedDirectories.length = 0;
      fsToolApi.allowedDirectories.push("/safe/dir1", "/safe/dir2");

      const handler = getToolHandler("list_allowed_directories");
      const result = await handler({});

      assert.strictEqual(result.isError, undefined);
      assert.ok(result.structuredContent);
      assert.deepStrictEqual(result.structuredContent, {
        success: true,
        directories: ["/safe/dir1", "/safe/dir2"],
      });

      // Clear after test
      fsToolApi.allowedDirectories.length = 0;
    });
  });
});
