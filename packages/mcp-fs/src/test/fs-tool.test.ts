import assert from "node:assert";
import fs from "node:fs/promises";
import path from "node:path";
import {after, beforeEach, describe, mock, test} from "node:test";
import {fsToolApi} from "../index.js";

// --- Mock Setup ---
let mockCalls: {
  validatePath: string[];
  readFile: string | null;
  writeFile: {path: string; content: string} | null;
  mkdir: string | null;
  rename: {source: string; destination: string} | null;
  readdir: string | null;
  stat: string | null;
} = {} as any;

// We mock the internal API `validatePath` to simplify tests.
mock.method(fsToolApi, "validatePath", async (p: string) => {
  mockCalls.validatePath.push(p);
  return path.resolve(p);
});

mock.method(fs, "readFile", async (p: string) => {
  mockCalls.readFile = p;
  return "mock file content";
});

mock.method(fs, "writeFile", async (p: string, content: string) => {
  mockCalls.writeFile = {path: p, content};
});

mock.method(fs, "mkdir", async (p: string) => {
  mockCalls.mkdir = p;
});

mock.method(fs, "rename", async (source: string, destination: string) => {
  mockCalls.rename = {source, destination};
});

mock.method(fs, "readdir", async (p: string) => {
  mockCalls.readdir = p;
  return [
    {name: "file.txt", isDirectory: () => false, isFile: () => true},
    {name: "subdirectory", isDirectory: () => true, isFile: () => false},
  ] as any;
});

mock.method(fs, "stat", async (p: string) => {
  mockCalls.stat = p;
  return {
    size: 1024,
    birthtime: new Date("2023-01-01T00:00:00Z"),
    mtime: new Date("2023-01-02T00:00:00Z"),
    isDirectory: () => false,
    isFile: () => true,
    mode: 0o100644,
  } as any;
});

// --- Test Suite ---
interface ToolResult {
  content: {type: "text"; text: string}[];
  isError?: boolean;
}

function getToolHandler(toolName: keyof typeof fsToolApi.tools) {
  const handler = fsToolApi.tools[toolName]?.callback;
  if (!handler) {
    throw new Error(`Tool callback for "${toolName}" not found.`);
  }
  // @ts-ignore
  return (args: any) => handler(args, {} as any);
}

describe("MCP Filesystem Tool Handlers", () => {
  beforeEach(() => {
    mockCalls = {
      validatePath: [],
      readFile: null,
      writeFile: null,
      mkdir: null,
      rename: null,
      readdir: null,
      stat: null,
    };
    fsToolApi.allowedDirectories.length = 0;
    fsToolApi.allowedDirectories.push(path.resolve("/safe/dir"), path.resolve("/another/safe/place"));
  });

  after(() => {
    mock.restoreAll();
  });

  describe("`read_file` tool", () => {
    test("should validate and read a file", async () => {
      const handler = getToolHandler("read_file");
      const result = (await handler({path: "/safe/dir/file.txt"})) as ToolResult;
      assert.deepStrictEqual(mockCalls.validatePath, [path.resolve("/safe/dir/file.txt")]);
      assert.strictEqual(mockCalls.readFile, path.resolve("/safe/dir/file.txt"));
      assert.deepStrictEqual(result, {content: [{type: "text", text: "mock file content"}]});
    });

    test("should return an error if validation fails", async () => {
      mock.method(
        fsToolApi,
        "validatePath",
        async () => {
          throw new Error("Access denied");
        },
        {times: 1},
      );
      const handler = getToolHandler("read_file");
      const result = (await handler({path: "/forbidden/file.txt"})) as ToolResult;
      assert.strictEqual(result.isError, true);
      assert(result.content[0].text.includes("Error in tool 'read_file': Access denied"));
    });
  });

  describe("`write_file` tool", () => {
    test("should validate and write to a file", async () => {
      const handler = getToolHandler("write_file");
      const result = (await handler({path: "/safe/dir/new.txt", content: "hello world"})) as ToolResult;
      const resolvedPath = path.resolve("/safe/dir/new.txt");
      assert.deepStrictEqual(mockCalls.validatePath, [resolvedPath]);
      assert.deepStrictEqual(mockCalls.writeFile, {path: resolvedPath, content: "hello world"});
      assert(result.content[0].text.includes("Successfully wrote to /safe/dir/new.txt"));
    });
  });

  describe("`edit_file` tool", () => {
    test("should return a diff by default", async () => {
      const handler = getToolHandler("edit_file");
      const result = (await handler({
        path: "/safe/dir/doc.txt",
        edits: [{oldText: "mock file content", newText: "edited mock content"}],
      })) as ToolResult;

      const expectedNewContent = "edited mock content";
      const resolvedPath = path.resolve("/safe/dir/doc.txt");
      assert.deepStrictEqual(mockCalls.writeFile, {path: resolvedPath, content: expectedNewContent});

      const text = result.content[0].text;
      assert(text.includes(`Successfully applied edits to ${resolvedPath}.`), "Success message is missing.");
      assert(text.includes("```diff\n"), "Diff block start is missing.");
      assert(text.includes(`--- ${resolvedPath}`), "Diff header '---' is missing or incorrect.");
      assert(text.includes(`+++ ${resolvedPath}`), "Diff header '+++' is missing or incorrect.");
      assert(text.includes("\n-mock file content"), "Removed line is missing from diff.");
      assert(text.includes("\n+edited mock content"), "Added line is missing from diff.");
    });

    test("should return the full content when returnStyle is 'full'", async () => {
      const handler = getToolHandler("edit_file");
      const result = (await handler({
        path: "/safe/dir/doc.txt",
        edits: [{oldText: "mock file content", newText: "new full content"}],
        returnStyle: "full",
      })) as ToolResult;

      const expectedNewContent = "new full content";
      const resolvedPath = path.resolve("/safe/dir/doc.txt");
      const status = `Successfully applied edits to ${resolvedPath}.`;
      const expectedOutput = `${status}\n${expectedNewContent}`;

      assert.strictEqual(result.isError, undefined);
      assert.strictEqual(result.content[0].text, expectedOutput);
      assert.deepStrictEqual(mockCalls.writeFile?.content, expectedNewContent);
    });

    test("should return only a success message when returnStyle is 'none'", async () => {
      const handler = getToolHandler("edit_file");
      const result = (await handler({
        path: "/safe/dir/doc.txt",
        edits: [{oldText: "mock file content", newText: "a new change"}],
        returnStyle: "none",
      })) as ToolResult;

      const resolvedPath = path.resolve("/safe/dir/doc.txt");
      const expectedMessage = `Successfully applied edits to ${resolvedPath}.`;

      // Check that the file was still written
      assert.deepStrictEqual(mockCalls.writeFile?.content, "a new change");
      // Check that the response is ONLY the success message
      assert.strictEqual(result.content[0].text, expectedMessage);
    });

    test("should perform a dry run without writing to the file", async () => {
      const handler = getToolHandler("edit_file");
      const result = (await handler({
        path: "/safe/dir/doc.txt",
        edits: [{oldText: "mock file content", newText: "new content"}],
        dryRun: true,
      })) as ToolResult;

      const resolvedPath = path.resolve("/safe/dir/doc.txt");
      assert.strictEqual(mockCalls.writeFile, null, "writeFile should not have been called on a dry run");
      assert(result.content[0].text.includes(`Dry run successful. Proposed changes for ${resolvedPath}:`), "Dry run message is missing.");
      assert(result.content[0].text.includes("```diff"), "Diff should still be generated on dry run.");
    });

    test("should return a 'no changes' message if content is identical", async () => {
      const handler = getToolHandler("edit_file");
      const result = (await handler({
        path: "/safe/dir/doc.txt",
        edits: [{oldText: "mock file content", newText: "mock file content"}],
      })) as ToolResult;

      assert.strictEqual(mockCalls.writeFile, null, "writeFile should not be called when content is unchanged");
      assert(result.content[0].text.includes("No changes were made"), "Expected 'no changes' message was not found.");
    });
  });

  describe("`list_directory` tool", () => {
    test("should validate and list directory contents", async () => {
      const handler = getToolHandler("list_directory");
      const result = (await handler({path: "/safe/dir"})) as ToolResult;
      const resolvedPath = path.resolve("/safe/dir");
      assert.deepStrictEqual(mockCalls.validatePath, [resolvedPath]);
      assert.strictEqual(mockCalls.readdir, resolvedPath);
      const expectedOutput = "[FILE] file.txt\n[DIR]  subdirectory";
      assert.strictEqual(result.content[0].text, expectedOutput);
    });
  });

  describe("`create_directory` tool", () => {
    test("should validate and create a directory", async () => {
      const handler = getToolHandler("create_directory");
      await handler({path: "/safe/dir/new_dir"});
      const resolvedPath = path.resolve("/safe/dir/new_dir");
      assert.deepStrictEqual(mockCalls.validatePath, [resolvedPath]);
      assert.strictEqual(mockCalls.mkdir, resolvedPath);
    });
  });

  describe("`move_file` tool", () => {
    test("should validate both paths and move the file", async () => {
      const handler = getToolHandler("move_file");
      const sourcePath = path.resolve("/safe/dir/src.txt");
      const destPath = path.resolve("/another/safe/place/dest.txt");
      await handler({source: "/safe/dir/src.txt", destination: "/another/safe/place/dest.txt"});

      assert.deepStrictEqual(mockCalls.validatePath, [sourcePath, destPath]);
      assert.deepStrictEqual(mockCalls.rename, {source: sourcePath, destination: destPath});
    });
  });

  describe("`get_file_info` tool", () => {
    test("should validate and get file stats", async () => {
      const handler = getToolHandler("get_file_info");
      const resolvedPath = path.resolve("/safe/dir/file.txt");
      const result = (await handler({path: "/safe/dir/file.txt"})) as ToolResult;
      assert.deepStrictEqual(mockCalls.validatePath, [resolvedPath]);
      assert.strictEqual(mockCalls.stat, resolvedPath);
      assert(result.content[0].text.includes("size: 1024"));
      assert(result.content[0].text.includes("permissions: 644"));
      assert(result.content[0].text.includes("modified: 2023-01-02T00:00:00.000Z"));
    });
  });

  describe("`list_allowed_directories` tool", () => {
    test("should return the list of allowed directories", async () => {
      const handler = getToolHandler("list_allowed_directories");
      const result = (await handler({})) as ToolResult;
      assert.deepStrictEqual(mockCalls.validatePath, []);
      const expectedText = `This server can only access files and directories within the following paths:\n- ${path.resolve("/safe/dir")}\n- ${path.resolve("/another/safe/place")}`;
      assert.strictEqual(result.content[0].text, expectedText);
    });
  });
});
