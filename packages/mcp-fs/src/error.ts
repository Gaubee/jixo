// --- Custom Error Classes ---
/**
 * Thrown when a file operation attempts to access a path outside the allowed directories.
 */

export class AccessDeniedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AccessDeniedError";
  }
}
/**
 * Thrown when an edit operation cannot find the text it's supposed to replace,
 * indicating the file's content is not what the AI model expects.
 */

export class EditConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EditConflictError";
  }
}

/**
 * Thrown when attempting to delete a non-empty directory without the recursive flag.
 */
export class DeleteNonEmptyDirectoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DeleteNonEmptyDirectoryError";
  }
}
