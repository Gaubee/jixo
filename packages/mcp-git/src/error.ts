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

/**
 * Thrown when a commit operation is attempted with no staged changes.
 */
export class EmptyCommitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmptyCommitError";
  }
}

/**
 * Thrown when a merge operation results in conflicts.
 */
export class MergeConflictError extends Error {
  public readonly conflicts: string[];

  constructor(message: string, conflicts: string[] = []) {
    super(message);
    this.name = "MergeConflictError";
    this.conflicts = conflicts;
  }
}

/**
 * Thrown when a rebase operation results in conflicts.
 */
export class RebaseConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RebaseConflictError";
  }
}
