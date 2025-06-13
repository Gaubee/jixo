#!/usr/bin/env node

import {safeRegisterTool} from "@jixo/mcp-core";
import {McpServer} from "@modelcontextprotocol/sdk/server/mcp.js";
import {StdioServerTransport} from "@modelcontextprotocol/sdk/server/stdio.js";
import {createTwoFilesPatch} from "diff";
import {import_meta_ponyfill} from "import-meta-ponyfill";
import {minimatch} from "minimatch";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {z} from "zod";
import pkg from "../package.json" with {type: "json"};
import {AccessDeniedError, EditConflictError} from "./error.js";

// --- 1. Startup and Configuration ---
let allowedDirectories: string[] = [];

// Expands home directory tilde `~` and normalizes the path.
const expandHome = (filepath: string): string => {
  return filepath.startsWith("~/") || filepath === "~" ? path.join(os.homedir(), filepath.slice(1)) : filepath;
};

// --- 2. Core API and Helper Functions ---
// Encapsulated in an object to ensure stable references.
const helpers = {
  /**
   * Validates if a given path is within the allowed directories, handling symbolic links.
   * @throws {AccessDeniedError} If the path is invalid or not allowed.
   * @returns {Promise<string>} The validated and resolved absolute path.
   */
  async validatePath(requestedPath: string): Promise<string> {
    const expandedPath = expandHome(requestedPath);
    const absolute = path.isAbsolute(expandedPath) ? path.resolve(expandedPath) : path.resolve(process.cwd(), expandedPath);
    const normalizedRequested = path.normalize(absolute);

    if (allowedDirectories.length > 0 && !allowedDirectories.some((dir) => normalizedRequested.startsWith(dir))) {
      throw new AccessDeniedError(`Access denied: Path '${absolute}' is outside the allowed directories.`);
    }

    try {
      const realPath = await fs.realpath(absolute);
      if (allowedDirectories.length > 0 && !allowedDirectories.some((dir) => realPath.startsWith(dir))) {
        throw new AccessDeniedError("Access denied: Symbolic link points to a location outside the allowed directories.");
      }
      return realPath;
    } catch (error: any) {
      if (error.code === "ENOENT") {
        const parentDir = path.dirname(normalizedRequested);
        try {
          const realParentDir = await fs.realpath(parentDir);
          if (allowedDirectories.length > 0 && !allowedDirectories.some((dir) => realParentDir.startsWith(dir))) {
            throw new AccessDeniedError(`Access denied: Cannot create item in directory '${parentDir}' as it is outside the allowed sandbox.`);
          }
          return normalizedRequested;
        } catch (parentError: any) {
          if (parentError.code === "ENOENT") {
            throw new Error(`Parent directory does not exist: ${parentDir}`);
          }
          throw parentError;
        }
      }
      throw error;
    }
  },

  /**
   * Applies a series of edits to a file's content and returns the original and modified states.
   * @throws {EditConflictError} If the text to be replaced is not found.
   * @returns {Promise<{originalContent: string; modifiedContent: string}>}
   */
  async applyFileEdits(filePath: string, edits: {oldText: string; newText: string}[]): Promise<{originalContent: string; modifiedContent: string}> {
    const normalize = (text: string) => text.replace(/\r\n/g, "\n");
    const originalContent = normalize(await fs.readFile(filePath, "utf-8"));
    let modifiedContent = originalContent;

    for (const edit of edits) {
      const normalizedOld = normalize(edit.oldText);
      const normalizedNew = normalize(edit.newText);
      if (modifiedContent.indexOf(normalizedOld) === -1) {
        throw new EditConflictError(`Could not apply edit: The text to be replaced was not found in the file.\n--- TEXT NOT FOUND ---\n${edit.oldText}`);
      }
      modifiedContent = modifiedContent.replace(normalizedOld, normalizedNew);
    }
    return {originalContent, modifiedContent};
  },
};

// --- 3. Schema Definitions ---

// --- Input Schemas ---
const ReadFileArgsSchema = {path: z.string().describe("The full path to the file to read.")};
const WriteFileArgsSchema = {
  path: z.string().describe("The full path to the file to write."),
  content: z.string().describe("The content to write to the file."),
};
const EditFileArgsSchema = {
  path: z.string().describe("The path to the file to edit."),
  edits: z
    .array(z.object({oldText: z.string(), newText: z.string()}))
    .min(1)
    .describe("A list of search-and-replace operations."),
  dryRun: z.boolean().default(false).optional().describe("If true, returns the diff without modifying the file."),
  returnStyle: z
    .enum(["diff", "full", "none"])
    .default("diff")
    .optional()
    .describe(
      "Controls what content is returned after a successful edit. " +
        "CHOICE GUIDANCE: " +
        "1. 'diff' (default): Best for small, targeted changes. Returns a git-style diff, which is token-efficient and clearly shows what changed. " +
        "2. 'full': Best for large or complex changes. Returns the entire new file content. Use this when the changes are substantial or when you need the complete file state for subsequent steps. " +
        "3. 'none': The most token-efficient option. Returns only a success message with no content. Use this when you are highly confident in the edit and do not need to verify the result.",
    ),
};
const ListDirectoryArgsSchema = {path: z.string().describe("The path to the directory to list.")};
const CreateDirectoryArgsSchema = {path: z.string().describe("The path to the directory to create (recursively).")};
const MoveFileArgsSchema = {
  source: z.string().describe("The source path of the file or directory to move."),
  destination: z.string().describe("The destination path."),
};
const CopyFileArgsSchema = {
  source: z.string().describe("The path of the file to copy."),
  destination: z.string().describe("The path where the copy will be created."),
};
const SearchFilesArgsSchema = {
  path: z.string().describe("The root directory to start the search from."),
  pattern: z.string().describe("A case-insensitive substring to search for in file/directory names."),
  excludePatterns: z.array(z.string()).optional().default([]).describe("A list of glob patterns to exclude (e.g., 'node_modules', '*.log')."),
};
const GetFileInfoArgsSchema = {path: z.string().describe("The path to the file or directory to get info for.")};

// --- Output Schemas ---
// A reusable error structure for all tool outputs.
const GenericErrorSchema = {
  error: z
    .object({
      name: z.string().describe("The type of error, e.g., 'AccessDeniedError'."),
      message: z.string().describe("A detailed description of what went wrong."),
    })
    .optional()
    .describe("Included only when 'success' is false."),
};

const SuccessOutputSchema = {
  success: z.boolean().describe("Indicates if the operation was successful."),
  path: z.string().optional(),
  message: z.string().optional(),
  ...GenericErrorSchema,
};

const ReadFileOutputSchema = {
  success: z.boolean().describe("Indicates if the operation was successful."),
  path: z.string().optional(),
  content: z.string().optional(),
  ...GenericErrorSchema,
};

const EditFileOutputSchema = {
  success: z.boolean().describe("Indicates if the operation was successful."),
  path: z.string().optional(),
  changesApplied: z.boolean().optional(),
  diff: z.string().nullable().optional(),
  newContent: z.string().optional().nullable(),
  message: z.string().optional(),
  ...GenericErrorSchema,
};

const ListDirectoryOutputSchema = {
  success: z.boolean().describe("Indicates if the operation was successful."),
  path: z.string().optional(),
  entries: z
    .array(
      z.object({
        name: z.string(),
        type: z.enum(["file", "directory"]),
      }),
    )
    .optional(),
  ...GenericErrorSchema,
};

const SearchFilesOutputSchema = {
  success: z.boolean().describe("Indicates if the operation was successful."),
  path: z.string().optional(),
  pattern: z.string().optional(),
  matches: z.array(z.string()).optional(),
  ...GenericErrorSchema,
};

const FileInfoOutputSchema = {
  success: z.boolean().describe("Indicates if the operation was successful."),
  path: z.string().optional(),
  type: z.enum(["file", "directory", "other"]).optional(),
  size: z.number().optional(),
  permissions: z.string().optional(),
  created: z.string().datetime().optional(),
  modified: z.string().datetime().optional(),
  ...GenericErrorSchema,
};

const ListAllowedDirectoriesOutputSchema = {
  success: z.boolean().describe("Indicates if the operation was successful."),
  directories: z.array(z.string()).optional(),
  ...GenericErrorSchema,
};

// --- 4. Server and Tool Registration ---

const server = new McpServer({
  name: "secure-filesystem-server",
  version: pkg.version,
});

/**
 * Centralized error handler for all tools.
 * It formats the error message and provides specific suggestions for certain error types,
 * returning a structured response that conforms to the tool's output schema.
 * @param toolName The name of the tool that failed.
 * @param error The caught error object.
 * @returns A structured error object for the MCP client.
 */
const handleToolError = (toolName: string, error: unknown) => {
  let errorMessage: string;

  if (error instanceof EditConflictError) {
    // For EditConflictError, provide a specific suggestion.
    errorMessage = `${error.message}\n\nSuggestion: The file content may have changed. Use the 'read_file' tool to get the latest version before trying to edit again.`;
  } else if (error instanceof Error) {
    // For AccessDeniedError and other standard errors, use their message.
    errorMessage = error.message;
  } else {
    // Fallback for non-Error types.
    errorMessage = String(error);
  }

  console.error(`[ERROR in ${toolName}] ${errorMessage}`);

  const errorObj = error instanceof Error ? error : new Error(String(error), {cause: error});
  if (!errorObj.name || errorObj.name === "Error") {
    errorObj.name = error?.constructor?.name ?? "UnknownError";
  }

  return {
    isError: true,
    structuredContent: {
      success: false,
      error: {
        name: errorObj.name,
        message: errorMessage,
      },
    },
    content: [{type: "text" as const, text: `Error in tool '${toolName}': ${errorMessage}`}],
  };
};

const read_file_tool = safeRegisterTool(
  server,
  "read_file",
  {
    description: "Read the complete contents of a single file.",
    inputSchema: ReadFileArgsSchema,
    outputSchema: ReadFileOutputSchema,
  },
  async ({path}) => {
    try {
      const validPath = await helpers.validatePath(path);
      const content = await fs.readFile(validPath, "utf-8");
      return {
        structuredContent: {success: true, path: validPath, content},
        content: [{type: "text", text: content}],
      };
    } catch (error) {
      return handleToolError("read_file", error);
    }
  },
);

const write_file_tool = safeRegisterTool(
  server,
  "write_file",
  {
    description: "Create a new file or completely overwrite an existing file with new content. Use with caution.",
    inputSchema: WriteFileArgsSchema,
    outputSchema: SuccessOutputSchema,
  },
  async ({path, content}) => {
    try {
      const validPath = await helpers.validatePath(path);
      await fs.writeFile(validPath, content, "utf-8");
      const message = `Successfully wrote to ${path}`;
      return {
        structuredContent: {success: true, path: validPath, message},
        content: [{type: "text", text: message}],
      };
    } catch (error) {
      return handleToolError("write_file", error);
    }
  },
);

const edit_file_tool = safeRegisterTool(
  server,
  "edit_file",
  {
    description: "Performs precise edits on a text file and allows choosing the return format for verification.",
    inputSchema: EditFileArgsSchema,
    outputSchema: EditFileOutputSchema,
  },
  async ({path, edits, dryRun, returnStyle = "diff"}) => {
    try {
      const validPath = await helpers.validatePath(path);
      const {originalContent, modifiedContent} = await helpers.applyFileEdits(validPath, edits);
      const changesApplied = originalContent !== modifiedContent;
      let diff: string | null = null;
      let statusMessage: string;
      let responseText = "";

      if (!changesApplied) {
        statusMessage = `No changes were made to the file '${validPath}'; content is identical.`;
      } else {
        if (!dryRun) {
          await fs.writeFile(validPath, modifiedContent, "utf-8");
        }
        statusMessage = dryRun ? `Dry run successful. Proposed changes for ${validPath}:` : `Successfully applied edits to ${validPath}.`;
        diff = createTwoFilesPatch(validPath, validPath, originalContent, modifiedContent, "", "", {context: 3});
      }

      if (changesApplied && returnStyle !== "none") {
        if (returnStyle === "full") {
          responseText = modifiedContent;
        } else if (returnStyle === "diff" && diff) {
          let backticks = "```";
          while (diff.includes(backticks)) backticks += "`";
          responseText = `${backticks}diff\n${diff}\n${backticks}`;
        }
      }

      const finalMessage = responseText ? `${statusMessage}\n${responseText}` : statusMessage;
      return {
        structuredContent: {
          success: true,
          path: validPath,
          changesApplied,
          diff,
          newContent: returnStyle === "full" ? modifiedContent : null,
          message: statusMessage,
        },
        content: [{type: "text", text: finalMessage}],
      };
    } catch (error) {
      return handleToolError("edit_file", error);
    }
  },
);

const list_directory_tool = safeRegisterTool(
  server,
  "list_directory",
  {
    description: "Get a detailed listing of all files and directories in a specified path.",
    inputSchema: ListDirectoryArgsSchema,
    outputSchema: ListDirectoryOutputSchema,
  },
  async ({path}) => {
    try {
      const validPath = await helpers.validatePath(path);
      const entries = await fs.readdir(validPath, {withFileTypes: true});
      const structuredEntries = entries.map((e) => ({
        name: e.name,
        type: (e.isDirectory() ? "directory" : "file") as "file" | "directory",
      }));

      if (entries.length === 0) {
        const message = `Directory '${path}' is empty.`;
        return {
          structuredContent: {success: true, path: validPath, entries: []},
          content: [{type: "text", text: message}],
        };
      }
      const formatted = structuredEntries.map((e) => `${e.type === "directory" ? "[DIR] " : "[FILE]"} ${e.name}`).join("\n");
      return {
        structuredContent: {success: true, path: validPath, entries: structuredEntries},
        content: [{type: "text", text: formatted}],
      };
    } catch (error) {
      return handleToolError("list_directory", error);
    }
  },
);

const create_directory_tool = safeRegisterTool(
  server,
  "create_directory",
  {
    description: "Create a new directory, including any necessary parent directories.",
    inputSchema: CreateDirectoryArgsSchema,
    outputSchema: SuccessOutputSchema,
  },
  async ({path}) => {
    try {
      const validPath = await helpers.validatePath(path);
      await fs.mkdir(validPath, {recursive: true});
      const message = `Successfully created directory ${path}`;
      return {
        structuredContent: {success: true, path: validPath, message},
        content: [{type: "text", text: message}],
      };
    } catch (error) {
      return handleToolError("create_directory", error);
    }
  },
);

const move_file_tool = safeRegisterTool(
  server,
  "move_file",
  {
    description: "Move or rename a file or directory.",
    inputSchema: MoveFileArgsSchema,
    outputSchema: SuccessOutputSchema,
  },
  async ({source, destination}) => {
    try {
      const validSource = await helpers.validatePath(source);
      const validDest = await helpers.validatePath(destination);
      await fs.rename(validSource, validDest);
      const message = `Successfully moved ${source} to ${destination}`;
      return {
        structuredContent: {success: true, path: validDest, message},
        content: [{type: "text", text: message}],
      };
    } catch (error) {
      return handleToolError("move_file", error);
    }
  },
);

const copy_file_tool = safeRegisterTool(
  server,
  "copy_file",
  {
    description: "Copies a file from a source path to a destination path.",
    inputSchema: CopyFileArgsSchema,
    outputSchema: SuccessOutputSchema,
  },
  async ({source, destination}) => {
    try {
      const validSource = await helpers.validatePath(source);
      const validDest = await helpers.validatePath(destination);
      await fs.copyFile(validSource, validDest);
      const message = `Successfully copied ${source} to ${destination}`;
      return {
        structuredContent: {success: true, path: validDest, message},
        content: [{type: "text", text: message}],
      };
    } catch (error) {
      return handleToolError("copy_file", error);
    }
  },
);

const search_files_tool = safeRegisterTool(
  server,
  "search_files",
  {
    description: "Recursively search for files and directories matching a pattern within a given path.",
    inputSchema: SearchFilesArgsSchema,
    outputSchema: SearchFilesOutputSchema,
  },
  async ({path: rootPath, pattern, excludePatterns}) => {
    try {
      const validRootPath = await helpers.validatePath(rootPath);
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
      return {
        structuredContent: {success: true, path: rootPath, pattern, matches: results},
        content: [{type: "text", text: output}],
      };
    } catch (error) {
      return handleToolError("search_files", error);
    }
  },
);

const get_file_info_tool = safeRegisterTool(
  server,
  "get_file_info",
  {
    description: "Retrieve detailed metadata about a file or directory (size, dates, permissions).",
    inputSchema: GetFileInfoArgsSchema,
    outputSchema: FileInfoOutputSchema,
  },
  async ({path}) => {
    try {
      const validPath = await helpers.validatePath(path);
      const stats = await fs.stat(validPath);
      const info = {
        path: validPath,
        type: (stats.isDirectory() ? "directory" : stats.isFile() ? "file" : "other") as "file" | "directory" | "other",
        size: stats.size,
        permissions: (stats.mode & 0o777).toString(8),
        created: stats.birthtime.toISOString(),
        modified: stats.mtime.toISOString(),
      };
      const formatted = Object.entries(info)
        .map(([key, value]) => `${key}: ${value}`)
        .join("\n");
      return {
        structuredContent: {success: true, ...info},
        content: [{type: "text", text: formatted}],
      };
    } catch (error) {
      return handleToolError("get_file_info", error);
    }
  },
);

const list_allowed_directories_tool = safeRegisterTool(
  server,
  "list_allowed_directories",
  {
    description: "Returns the list of root directories the server is allowed to access.",
    inputSchema: {}, // No arguments
    outputSchema: ListAllowedDirectoriesOutputSchema,
  },
  async () => {
    const text =
      allowedDirectories.length > 0
        ? `This server can only access files and directories within the following paths:\n- ${allowedDirectories.join("\n- ")}`
        : "Warning: No directory restrictions are set. The server can access any path.";
    return {
      structuredContent: {success: true, directories: allowedDirectories},
      content: [{type: "text", text}],
    };
  },
);

// A fully type-safe collection of all registered tools.
const tools = {
  read_file: read_file_tool,
  write_file: write_file_tool,
  edit_file: edit_file_tool,
  list_directory: list_directory_tool,
  create_directory: create_directory_tool,
  move_file: move_file_tool,
  copy_file: copy_file_tool,
  search_files: search_files_tool,
  get_file_info: get_file_info_tool,
  list_allowed_directories: list_allowed_directories_tool,
};

// **THE FIX IS HERE**: Export the internal API object directly to maintain a stable reference for mocking.
export const fsToolApi = {
  allowedDirectories,
  server,
  tools,
  helpers,
};

// --- 5. Server Startup ---

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

async function main(dirs: string[]) {
  if (dirs.length > 0) {
    allowedDirectories = await Promise.all(
      dirs.map(async (dir) => {
        const expanded = expandHome(dir);
        const resolved = path.resolve(expanded);
        try {
          return await fs.realpath(resolved);
        } catch (e: any) {
          if (e.code === "ENOENT") {
            console.error(`Error: The allowed directory path does not exist: ${resolved}`);
            process.exit(1);
          }
          throw e;
        }
      }),
    );
    await validateDirectories();
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error("Secure MCP Filesystem Server running on stdio.");
  if (allowedDirectories.length > 0) {
    console.error("Allowed directories:", allowedDirectories);
  } else {
    console.error("Warning: No directory restrictions specified. Access is not sandboxed.");
  }
}

/// from cli
if (import_meta_ponyfill(import.meta).main) {
  const dirs = process.argv.slice(2);
  if (dirs.length === 0) {
    console.error(`Usage: ${Object.keys(pkg.bin)[0]} <allowed-directory> [additional-directories...]`);
    process.exit(1);
  }
  main(dirs).catch((error) => {
    console.error("Fatal error running server:", error);
    process.exit(1);
  });
}
