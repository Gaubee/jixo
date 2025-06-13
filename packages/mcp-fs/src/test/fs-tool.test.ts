import type {CallToolResult, TextContent} from "@modelcontextprotocol/sdk/types.js";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import {afterEach, beforeEach, describe, mock, test} from "node:test";
import {z} from "zod";
import {AccessDeniedError, EditConflictError} from "../error.js";
import {fsToolApi} from "../index.js";

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

const SANDBOX = path.resolve("./mcp-fs-test-sandbox");

describe("MCP Filesystem Tool Handlers (Unit)", () => {
  // Mock the internal helper functions to isolate tool logic for testing.
  beforeEach(() => {
    mock.method(fsToolApi.helpers, "validatePath", (p: string) => path.resolve(p));
  });

  afterEach(() => {
    mock.restoreAll();
  });

  describe("`read_file` tool", () => {
    test("should return structured content on success", async (t) => {
      // Mock the underlying fs call for this specific test
      mock.method(fs, "readFileSync", () => "hello world");
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
      mock.method(fsToolApi.helpers, "validatePath", () => {
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
      mock.method(fs, "writeFileSync", () => {});
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
      mock.method(fsToolApi.helpers, "applyFileEdits", () => ({
        originalContent: "original",
        modifiedContent: "modified",
      }));
      mock.method(fs, "writeFileSync", () => {});

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
      mock.method(fsToolApi.helpers, "applyFileEdits", () => {
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
    test("should return structured list of entries for maxDepth 1", async (t) => {
      mock.method(fs, "readdirSync", () => [{name: "file.txt", isDirectory: () => false, isFile: () => true}] as any);
      const handler = getToolHandler("list_directory");
      const testPath = "/safe/dir";
      const result = await handler({path: testPath, maxDepth: 1});

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
      mock.method(fs, "statSync", () => stats as any);

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

      fsToolApi.allowedDirectories.length = 0;
    });
  });
});

describe("MCP Filesystem Tool Handlers (Integration)", () => {
  beforeEach(() => {
    mock.restoreAll(); // Use real implementations
    fs.rmSync(SANDBOX, {recursive: true, force: true});
    fs.mkdirSync(SANDBOX, {recursive: true});
    fsToolApi.allowedDirectories.length = 0;
    fsToolApi.allowedDirectories.push(SANDBOX);
  });

  afterEach(() => {
    fs.rmSync(SANDBOX, {recursive: true, force: true});
    fsToolApi.allowedDirectories.length = 0;
  });

  describe("`create_directory` tool", () => {
    test("should recursively create directories", async () => {
      const handler = getToolHandler("create_directory");
      const deepDirPath = path.join(SANDBOX, "a", "b", "c");

      assert.strictEqual(fs.existsSync(deepDirPath), false, "Precondition: Directory should not exist");
      const result = await handler({path: deepDirPath});
      assert.strictEqual(result.isError, undefined, `Tool failed: ${result.isError && getResultText(result)}`);
      assert.ok(fs.existsSync(deepDirPath), "Directory should be created");
    });
  });

  describe("`copy_path` tool", () => {
    test("should copy a file", async () => {
      const handler = getToolHandler("copy_path");
      const sourceFile = path.join(SANDBOX, "source.txt");
      const destFile = path.join(SANDBOX, "dest.txt");
      fs.writeFileSync(sourceFile, "test");

      const result = await handler({source: sourceFile, destination: destFile});
      assert.strictEqual(result.isError, undefined);
      const content = fs.readFileSync(destFile, "utf-8");
      assert.strictEqual(content, "test");
    });

    test("should recursively copy a directory", async () => {
      const handler = getToolHandler("copy_path");
      const sourceDir = path.join(SANDBOX, "source_dir");
      const destDir = path.join(SANDBOX, "dest_dir");
      fs.mkdirSync(sourceDir);
      fs.writeFileSync(path.join(sourceDir, "file.txt"), "hello");

      const result = await handler({source: sourceDir, destination: destDir, recursive: true});
      assert.strictEqual(result.isError, undefined, `Tool failed: ${result.isError && getResultText(result)}`);
      assert.ok(fs.existsSync(path.join(destDir, "file.txt")));
    });

    test("should fail to copy a directory if not recursive", async () => {
      const handler = getToolHandler("copy_path");
      const sourceDir = path.join(SANDBOX, "source_dir");
      fs.mkdirSync(sourceDir);

      const result = await handler({source: sourceDir, destination: path.join(SANDBOX, "dest_dir"), recursive: false});
      assert.ok(result.isError);
      assert.ok(getResultText(result).includes("Source is a directory, but 'recursive' option is not set to true"));
    });
  });

  describe("`delete_path` tool", () => {
    test("should delete a file", async () => {
      const handler = getToolHandler("delete_path");
      const fileToDelete = path.join(SANDBOX, "file.txt");
      fs.writeFileSync(fileToDelete, "delete me");
      assert.ok(fs.existsSync(fileToDelete));

      const result = await handler({path: fileToDelete});
      assert.strictEqual(result.isError, undefined);
      assert.strictEqual(fs.existsSync(fileToDelete), false);
    });

    test("should be idempotent and succeed if file does not exist", async () => {
      const handler = getToolHandler("delete_path");
      const fileToDelete = path.join(SANDBOX, "nonexistent.txt");
      assert.strictEqual(fs.existsSync(fileToDelete), false);

      const result = await handler({path: fileToDelete});
      assert.strictEqual(result.isError, undefined);
    });

    test("should fail to delete a non-empty directory if not recursive", async () => {
      const handler = getToolHandler("delete_path");
      const dirToDelete = path.join(SANDBOX, "dir");
      fs.mkdirSync(dirToDelete);
      fs.writeFileSync(path.join(dirToDelete, "file.txt"), "content");

      const result = await handler({path: dirToDelete, recursive: false});
      assert.ok(result.isError);
      const structured = result.structuredContent as any;
      assert.strictEqual(structured.error.name, "DeleteNonEmptyDirectoryError");
      assert.ok(getResultText(result).includes("Suggestion: To delete a non-empty directory, set the 'recursive' parameter to true"));
    });
  });

  describe("`list_directory` (recursive) tool", () => {
    test("should generate a correct directory tree", async () => {
      const handler = getToolHandler("list_directory");
      const dirA = path.join(SANDBOX, "a");
      const dirB = path.join(dirA, "b");
      fs.mkdirSync(dirB, {recursive: true});
      fs.writeFileSync(path.join(SANDBOX, "file1.txt"), "");
      fs.writeFileSync(path.join(dirA, "file2.txt"), "");

      const result = await handler({path: SANDBOX, maxDepth: 3});
      assert.strictEqual(result.isError, undefined);

      const structured = result.structuredContent as any;
      assert.strictEqual(structured.success, true);
      assert.strictEqual(structured.entries.length, 2); // 'a' and 'file1.txt' at root
      const dirAEntry = structured.entries.find((e: any) => e.name === "a");
      assert.ok(dirAEntry);
      assert.strictEqual(dirAEntry.children.length, 2); // 'b' and 'file2.txt' in 'a'
    });

    test("should respect maxDepth", async () => {
      const handler = getToolHandler("list_directory");
      const dirA = path.join(SANDBOX, "a");
      const dirB = path.join(dirA, "b");
      fs.mkdirSync(dirB, {recursive: true});

      const result = await handler({path: SANDBOX, maxDepth: 2});
      assert.strictEqual(result.isError, undefined);

      const structured = result.structuredContent as any;
      const dirAEntry = structured.entries.find((e: any) => e.name === "a");
      assert.ok(dirAEntry);
      const dirBEntry = dirAEntry.children.find((e: any) => e.name === "b");
      assert.ok(dirBEntry);
      assert.deepStrictEqual(dirBEntry.children, []); // 'b' children are not listed due to maxDepth
    });
  });
});
