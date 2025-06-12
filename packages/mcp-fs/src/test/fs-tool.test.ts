import assert from "node:assert";
import fs from "node:fs/promises";
import {after, beforeEach, describe, mock, test} from "node:test";
import {fsToolApi} from "../index.js";

// --- Mock Setup ---
let mockCalls: {
  validatePath: string[] | null;
  readFile: string | null;
  writeFile: {path: string; content: string} | null;
  mkdir: string | null;
  rename: {source: string; destination: string} | null;
  readdir: string | null;
  stat: string | null;
} = {} as any;

mock.method(fsToolApi, "validatePath", async (p: string) => {
  mockCalls.validatePath?.push(p);
  return p;
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
    mode: 33188,
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
    fsToolApi.allowedDirectories.push("/safe/dir", "/another/safe/place");
  });

  after(() => {
    mock.restoreAll();
  });

  describe("`read_file` tool", () => {
    test("should validate and read a file", async () => {
      const handler = getToolHandler("read_file");
      const result = (await handler({path: "/safe/dir/file.txt"})) as ToolResult;
      assert.deepStrictEqual(mockCalls.validatePath, ["/safe/dir/file.txt"]);
      assert.strictEqual(mockCalls.readFile, "/safe/dir/file.txt");
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
      assert.deepStrictEqual(mockCalls.validatePath, ["/safe/dir/new.txt"]);
      assert.deepStrictEqual(mockCalls.writeFile, {path: "/safe/dir/new.txt", content: "hello world"});
      assert(result.content[0].text.includes("Successfully wrote to /safe/dir/new.txt"));
    });
  });

  describe("`edit_file` tool", () => {
    test("should read, edit, and write back the file", async () => {
      // **FIX**: We will not use a temporary mock. Instead, we adapt the test
      // to the behavior of the global mock for fs.readFile.
      const handler = getToolHandler("edit_file");

      // The global mock for fs.readFile returns "mock file content".
      // We will base our edit on that.
      const result = (await handler({
        path: "/safe/dir/doc.txt",
        edits: [
          {
            oldText: "mock file content",
            newText: "edited mock file content",
          },
        ],
        dryRun: false,
      })) as ToolResult;

      const expectedNewContent = "edited mock file content";

      // These assertions will now pass because we are using the predictable global mock.
      assert.deepStrictEqual(mockCalls.validatePath, ["/safe/dir/doc.txt"]);
      assert.strictEqual(mockCalls.readFile, "/safe/dir/doc.txt");
      assert.deepStrictEqual(mockCalls.writeFile, {path: "/safe/dir/doc.txt", content: expectedNewContent});

      // These assertions will also pass because a change occurred.
      assert(result.content[0].text.includes("--- a/safe/dir/doc.txt"), "Diff header '---' is missing");
      assert(result.content[0].text.includes("+++ b/safe/dir/doc.txt"), "Diff header '+++' is missing");
      assert(result.content[0].text.includes("-mock file content"), "Removed line is missing from diff");
      assert(result.content[0].text.includes("+edited mock file content"), "Added line is missing from diff");
    });

    test("should perform a dry run without writing", async () => {
      const handler = getToolHandler("edit_file");
      await handler({
        path: "/safe/dir/doc.txt",
        edits: [{oldText: "mock file content", newText: "edited content"}],
        dryRun: true,
      });

      assert.strictEqual(mockCalls.writeFile, null, "writeFile should not be called on dry run");
    });
  });

  describe("`list_directory` tool", () => {
    test("should validate and list directory contents", async () => {
      const handler = getToolHandler("list_directory");
      const result = (await handler({path: "/safe/dir"})) as ToolResult;
      assert.deepStrictEqual(mockCalls.validatePath, ["/safe/dir"]);
      assert.strictEqual(mockCalls.readdir, "/safe/dir");
      const expectedOutput = "[FILE] file.txt\n[DIR]  subdirectory";
      assert.strictEqual(result.content[0].text, expectedOutput);
    });
  });

  describe("`create_directory` tool", () => {
    test("should validate and create a directory", async () => {
      const handler = getToolHandler("create_directory");
      await handler({path: "/safe/dir/new_dir"});
      assert.deepStrictEqual(mockCalls.validatePath, ["/safe/dir/new_dir"]);
      assert.strictEqual(mockCalls.mkdir, "/safe/dir/new_dir");
    });
  });

  describe("`move_file` tool", () => {
    test("should validate both paths and move the file", async () => {
      const handler = getToolHandler("move_file");
      await handler({source: "/safe/dir/src.txt", destination: "/another/safe/place/dest.txt"});
      assert.deepStrictEqual(mockCalls.validatePath, ["/safe/dir/src.txt", "/another/safe/place/dest.txt"]);
      assert.deepStrictEqual(mockCalls.rename, {source: "/safe/dir/src.txt", destination: "/another/safe/place/dest.txt"});
    });
  });

  describe("`get_file_info` tool", () => {
    test("should validate and get file stats", async () => {
      const handler = getToolHandler("get_file_info");
      const result = (await handler({path: "/safe/dir/file.txt"})) as ToolResult;
      assert.deepStrictEqual(mockCalls.validatePath, ["/safe/dir/file.txt"]);
      assert.strictEqual(mockCalls.stat, "/safe/dir/file.txt");
      assert(result.content[0].text.includes("size: 1024"));
      assert(result.content[0].text.includes("permissions: 644"));
      assert(result.content[0].text.includes("modified: 2023-01-02T00:00:00.000Z"));
    });
  });

  describe("`list_allowed_directories` tool", () => {
    test("should return the list of allowed directories set in the test", async () => {
      const handler = getToolHandler("list_allowed_directories");
      const result = (await handler({})) as ToolResult;
      assert.deepStrictEqual(mockCalls.validatePath, []);
      const expectedText = `This server can only access files and directories within the following paths:\n- /safe/dir\n- /another/safe/place`;
      assert.strictEqual(result.content[0].text, expectedText);
    });
  });
});
