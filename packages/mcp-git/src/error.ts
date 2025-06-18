/**
 * Thrown when an operation is attempted on a path that is not a valid Git repository.
 */
export class InvalidRepoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidRepoError";
  }
}

/**
 * A general error for failed Git commands.
 */
export class GitCommandError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GitCommandError";
  }
}
