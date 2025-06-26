import {McpToolError} from "@jixo/mcp-core";

/**
 * Thrown when an operation is denied due to insufficient permissions on a mounted path.
 */
export class PermissionDeniedError extends McpToolError {
  override readonly name = "PermissionDeniedError";
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

/**
 * Thrown when a file or directory is not found at the specified path.
 */
export class FileNotFoundError extends McpToolError {
  override readonly name = "FileNotFoundError";
  constructor(message: string) {
    super(message);
  }
}

/**
 * Thrown when a directory operation is attempted on a file.
 */
export class NotADirectoryError extends McpToolError {
  override readonly name = "NotADirectoryError";
  constructor(message: string) {
    super(message);
  }
}

/**
 * Thrown during startup if the same drive letter is assigned to multiple different paths.
 */
export class MountConflictError extends McpToolError {
  override readonly name = "MountConflictError";
  constructor(message: string) {
    super(message);
  }
}

/**
 * Thrown when an operation targets a path that does not fall within any mounted directory.
 */
export class PathNotMountedError extends McpToolError {
  override readonly name = "PathNotMountedError";
  constructor(message: string) {
    super(message);
  }
}
