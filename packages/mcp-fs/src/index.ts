import {McpServer, type RegisteredTool} from "@modelcontextprotocol/sdk/server/mcp.js";
import {StdioServerTransport} from "@modelcontextprotocol/sdk/server/stdio.js";
import {createTwoFilesPatch} from "diff";
import {import_meta_ponyfill} from "import-meta-ponyfill";
import {minimatch} from "minimatch";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {z} from "zod";
import pkg from "../package.json" with {type: "json"};

// --- 1. 启动与配置 ---
let allowedDirectories: string[] = [];

// 展开并规范化路径
const expandHome = (filepath: string): string => {
  return filepath.startsWith("~/") || filepath === "~" ? path.join(os.homedir(), filepath.slice(1)) : filepath;
};

// --- 2. 核心 API 和辅助函数 ---

const _fsApi = {
  /**
   * 验证给定路径是否在允许的目录范围内，并处理符号链接。
   * @throws {Error} 如果路径无效或不允许访问。
   * @returns {Promise<string>} 经过验证和解析的绝对路径。
   */
  async validatePath(requestedPath: string): Promise<string> {
    const expandedPath = expandHome(requestedPath);
    const absolute = path.isAbsolute(expandedPath) ? path.resolve(expandedPath) : path.resolve(process.cwd(), expandedPath);
    const normalizedRequested = path.normalize(absolute);

    if (!allowedDirectories.some((dir) => normalizedRequested.startsWith(dir))) {
      throw new Error(`Access denied: Path '${absolute}' is outside the allowed directories: ${allowedDirectories.join(", ")}`);
    }

    try {
      const realPath = await fs.realpath(absolute);
      const normalizedReal = path.normalize(realPath);
      if (!allowedDirectories.some((dir) => normalizedReal.startsWith(dir))) {
        throw new Error("Access denied: Symbolic link points to a location outside the allowed directories.");
      }
      return realPath;
    } catch (error: any) {
      if (error.code === "ENOENT") {
        // 文件或目录尚不存在，验证其父目录
        const parentDir = path.dirname(absolute);
        const realParentPath = await fs.realpath(parentDir).catch(() => {
          throw new Error(`Access denied: Parent directory '${parentDir}' does not exist or is inaccessible.`);
        });
        const normalizedParent = path.normalize(realParentPath);
        if (!allowedDirectories.some((dir) => normalizedParent.startsWith(dir))) {
          throw new Error("Access denied: Parent directory is outside the allowed directories.");
        }
        return absolute; // 返回预期的绝对路径，因为它将在允许的位置被创建
      }
      throw error; // 重新抛出其他错误
    }
  },

  /**
   * 对文件内容应用一系列编辑操作。
   * @returns {Promise<string>} 显示更改的 git-style diff。
   */
  async applyFileEdits(filePath: string, edits: {oldText: string; newText: string}[], dryRun = false): Promise<string> {
    const normalize = (text: string) => text.replace(/\r\n/g, "\n");
    const originalContent = normalize(await fs.readFile(filePath, "utf-8"));
    let modifiedContent = originalContent;

    for (const edit of edits) {
      const normalizedOld = normalize(edit.oldText);
      if (!modifiedContent.includes(normalizedOld)) {
        throw new Error(`Could not apply edit: The text to be replaced was not found in the file.\n--- TEXT NOT FOUND ---\n${edit.oldText}`);
      }
      modifiedContent = modifiedContent.replace(normalizedOld, normalize(edit.newText));
    }

    const diff = createTwoFilesPatch(filePath, filePath, originalContent, modifiedContent, "original", "modified");
    if (!dryRun) {
      await fs.writeFile(filePath, modifiedContent, "utf-8");
    }

    // 格式化 diff 以便在 markdown 中安全显示
    let backticks = "```";
    while (diff.includes(backticks)) {
      backticks += "`";
    }
    return `${backticks}diff\n${diff}\n${backticks}`;
  },
};

// --- 3. Schemas 定义 ---

const ReadFileArgsSchema = {path: z.string().describe("The full path to the file to read.")};
const WriteFileArgsSchema = {
  path: z.string().describe("The full path to the file to write."),
  content: z.string().describe("The content to write to the file."),
};
const EditFileArgsSchema = {
  path: z.string().describe("The path to the file to edit."),
  edits: z.array(z.object({oldText: z.string(), newText: z.string()})).describe("A list of search-and-replace operations."),
  dryRun: z.boolean().default(false).optional().describe("If true, returns the diff without modifying the file."),
};
const ListDirectoryArgsSchema = {path: z.string().describe("The path to the directory to list.")};
const CreateDirectoryArgsSchema = {path: z.string().describe("The path to the directory to create (recursively).")};
const MoveFileArgsSchema = {
  source: z.string().describe("The source path of the file or directory to move."),
  destination: z.string().describe("The destination path."),
};
const SearchFilesArgsSchema = {
  path: z.string().describe("The root directory to start the search from."),
  pattern: z.string().describe("A case-insensitive substring to search for in file/directory names."),
  excludePatterns: z.array(z.string()).optional().default([]).describe("A list of glob patterns to exclude (e.g., 'node_modules', '*.log')."),
};
const GetFileInfoArgsSchema = {path: z.string().describe("The path to the file or directory to get info for.")};

// 统一的输出 Schema，所有工具共享
const outputSchema = {
  content: z.array(z.object({type: z.literal("text"), text: z.string()})),
  isError: z.boolean().optional(),
};

// --- 4. 服务器和工具注册 ---

const server = new McpServer({
  name: "secure-filesystem-server",
  version: pkg.version,
});

const registeredTools: {[key: string]: RegisteredTool} = {};

const handleToolError = (toolName: string, error: unknown) => {
  const errorMessage = error instanceof Error ? error.message : String(error);
  console.error(`[ERROR in ${toolName}] ${errorMessage}`);
  return {
    isError: true,
    content: [{type: "text" as const, text: `Error in tool '${toolName}': ${errorMessage}`}],
  };
};

registeredTools.read_file = server.registerTool(
  "read_file",
  {
    description: "Read the complete contents of a single file.",
    inputSchema: ReadFileArgsSchema,
    outputSchema,
  },
  async ({path}) => {
    try {
      const validPath = await fsToolApi.validatePath(path);
      const content = await fs.readFile(validPath, "utf-8");
      return {content: [{type: "text", text: content}]};
    } catch (error) {
      return handleToolError("read_file", error);
    }
  },
);

registeredTools.write_file = server.registerTool(
  "write_file",
  {
    description: "Create a new file or completely overwrite an existing file with new content. Use with caution.",
    inputSchema: WriteFileArgsSchema,
    outputSchema,
  },
  async ({path, content}) => {
    try {
      const validPath = await fsToolApi.validatePath(path);
      await fs.writeFile(validPath, content, "utf-8");
      return {content: [{type: "text", text: `Successfully wrote to ${path}`}]};
    } catch (error) {
      return handleToolError("write_file", error);
    }
  },
);

registeredTools.edit_file = server.registerTool(
  "edit_file",
  {
    description: "Performs precise, non-destructive edits on a text file by replacing sections of text. Returns a git-style diff of the changes.",
    inputSchema: EditFileArgsSchema,
    outputSchema,
  },
  async ({path, edits, dryRun}) => {
    try {
      const validPath = await fsToolApi.validatePath(path);
      const diff = await fsToolApi.applyFileEdits(validPath, edits, dryRun);
      const message = dryRun ? `Dry run successful. Changes for ${path}:\n${diff}` : `Successfully applied edits to ${path}.\n${diff}`;
      return {content: [{type: "text", text: message}]};
    } catch (error) {
      return handleToolError("edit_file", error);
    }
  },
);

registeredTools.list_directory = server.registerTool(
  "list_directory",
  {
    description: "Get a detailed listing of all files and directories in a specified path.",
    inputSchema: ListDirectoryArgsSchema,
    outputSchema,
  },
  async ({path}) => {
    try {
      const validPath = await fsToolApi.validatePath(path);
      const entries = await fs.readdir(validPath, {withFileTypes: true});
      if (entries.length === 0) {
        return {content: [{type: "text", text: `Directory '${path}' is empty.`}]};
      }
      const formatted = entries.map((entry) => `${entry.isDirectory() ? "[DIR] " : "[FILE]"} ${entry.name}`).join("\n");
      return {content: [{type: "text", text: formatted}]};
    } catch (error) {
      return handleToolError("list_directory", error);
    }
  },
);

registeredTools.create_directory = server.registerTool(
  "create_directory",
  {
    description: "Create a new directory, including any necessary parent directories.",
    inputSchema: CreateDirectoryArgsSchema,
    outputSchema,
  },
  async ({path}) => {
    try {
      const validPath = await fsToolApi.validatePath(path);
      await fs.mkdir(validPath, {recursive: true});
      return {content: [{type: "text", text: `Successfully created directory ${path}`}]};
    } catch (error) {
      return handleToolError("create_directory", error);
    }
  },
);

registeredTools.move_file = server.registerTool(
  "move_file",
  {
    description: "Move or rename a file or directory.",
    inputSchema: MoveFileArgsSchema,
    outputSchema,
  },
  async ({source, destination}) => {
    try {
      const validSource = await fsToolApi.validatePath(source);
      const validDest = await fsToolApi.validatePath(destination);
      await fs.rename(validSource, validDest);
      return {content: [{type: "text", text: `Successfully moved ${source} to ${destination}`}]};
    } catch (error) {
      return handleToolError("move_file", error);
    }
  },
);

registeredTools.search_files = server.registerTool(
  "search_files",
  {
    description: "Recursively search for files and directories matching a pattern within a given path.",
    inputSchema: SearchFilesArgsSchema,
    outputSchema,
  },
  async ({path: rootPath, pattern, excludePatterns}) => {
    try {
      const validRootPath = await fsToolApi.validatePath(rootPath);
      const results: string[] = [];
      const searchQueue: string[] = [validRootPath];

      while (searchQueue.length > 0) {
        const currentPath = searchQueue.shift()!;
        const entries = await fs.readdir(currentPath, {withFileTypes: true});

        for (const entry of entries) {
          const fullPath = path.join(currentPath, entry.name);
          const relativePath = path.relative(validRootPath, fullPath);

          const isExcluded = excludePatterns.some((p) => minimatch(relativePath, p, {dot: true}));
          if (isExcluded) continue;

          if (entry.name.toLowerCase().includes(pattern.toLowerCase())) {
            results.push(fullPath);
          }
          if (entry.isDirectory()) {
            searchQueue.push(fullPath);
          }
        }
      }

      const output = results.length > 0 ? results.join("\n") : `No matches found for "${pattern}" in "${rootPath}".`;
      return {content: [{type: "text", text: output}]};
    } catch (error) {
      return handleToolError("search_files", error);
    }
  },
);

registeredTools.get_file_info = server.registerTool(
  "get_file_info",
  {
    description: "Retrieve detailed metadata about a file or directory (size, dates, permissions).",
    inputSchema: GetFileInfoArgsSchema,
    outputSchema,
  },
  async ({path}) => {
    try {
      const validPath = await fsToolApi.validatePath(path);
      const stats = await fs.stat(validPath);
      const info = {
        path: validPath,
        type: stats.isDirectory() ? "directory" : stats.isFile() ? "file" : "other",
        size: stats.size,
        permissions: stats.mode.toString(8).slice(-3),
        created: stats.birthtime.toISOString(),
        modified: stats.mtime.toISOString(),
      };
      const formatted = Object.entries(info)
        .map(([key, value]) => `${key}: ${value}`)
        .join("\n");
      return {content: [{type: "text", text: formatted}]};
    } catch (error) {
      return handleToolError("get_file_info", error);
    }
  },
);

registeredTools.list_allowed_directories = server.registerTool(
  "list_allowed_directories",
  {
    description: "Returns the list of root directories the server is allowed to access.",
    inputSchema: {}, // No arguments
    outputSchema,
  },
  async () => {
    // This tool is safe and does not need a try/catch
    const text = `This server can only access files and directories within the following paths:\n- ${allowedDirectories.join("\n- ")}`;
    return {content: [{type: "text", text}]};
  },
);

// Export a consistent API object for testing
export const fsToolApi = {
  allowedDirectories,
  server,
  tools: registeredTools,
  ..._fsApi,
};

// --- 5. 服务器启动 ---

async function validateDirectories() {
  for (const dir of allowedDirectories) {
    try {
      const stats = await fs.stat(dir);
      if (!stats.isDirectory()) {
        console.error(`Error: The specified allowed path '${dir}' is not a directory.`);
        process.exit(1);
      }
    } catch (error) {
      console.error(`Error: Could not access the specified allowed directory '${dir}'.`, error);
      process.exit(1);
    }
  }
}

async function main() {
  // 命令行参数解析
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error("Usage: mcp-fs <allowed-directory> [additional-directories...]");
    process.exit(1);
  }
  allowedDirectories = args.map((dir) => path.normalize(path.resolve(expandHome(dir))));

  await validateDirectories();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Secure MCP Filesystem Server running on stdio.");
  console.error("Allowed directories:", allowedDirectories);
}

if (import_meta_ponyfill(import.meta).main) {
  main().catch((error) => {
    console.error("Fatal error running server:", error);
    process.exit(1);
  });
}
