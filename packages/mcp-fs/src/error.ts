import {McpToolError} from "@jixo/mcp-core";

/**
 * Thrown when a file operation attempts to access a path outside the allowed directories.
 */
export class AccessDeniedError extends McpToolError {
  override readonly name = "AccessDeniedError";
  constructor(message: string) {
    super(message);
  }
}
/**
 * Thrown when an edit operation cannot find the text it's supposed to replace,
 * indicating the file's content is not what the AI model expects.
 */
export class EditConflictError extends McpToolError {
  override readonly name = "EditConflictError";
  constructor(message: string) {
    super(message, [{tool_name: "read_file", description: "The file content may have changed. Use 'read_file' to get the latest version before trying to edit again."}]);
  }
}

/**
 * Thrown when attempting to delete a non-empty directory without the recursive flag.
 */
export class DeleteNonEmptyDirectoryError extends McpToolError {
  override readonly name = "DeleteNonEmptyDirectoryError";
  constructor(message: string) {
    super(message, [{tool_name: "delete_path", description: "To delete a non-empty directory, set the 'recursive' parameter to true."}]);
  }
}

/**
 * Thrown for various invalid filesystem operations, such as writing to a directory.
 */
export class InvalidOperationError extends McpToolError {
  override readonly name = "InvalidOperationError";
  constructor(message: string) {
    super(message);
  }
}
