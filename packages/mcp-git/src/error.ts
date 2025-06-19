import {McpToolError, returnError} from "@jixo/mcp-core";

export class InvalidRepoError extends McpToolError {
  override readonly name = "InvalidRepoError";
  constructor(message: string) {
    super(message);
  }
}

export class GitCommandError extends McpToolError {
  override readonly name = "GitCommandError";
  constructor(message: string) {
    super(message);
  }
}

export class EmptyCommitError extends McpToolError {
  override readonly name = "EmptyCommitError";
  constructor(message: string) {
    super(message, [
      {tool_name: "git_status", description: "Run git_status to see the current state of the repository."},
      {tool_name: "git_add", description: "Use git_add to stage changes before committing."},
    ]);
  }
}

export class MergeConflictError extends McpToolError {
  override readonly name = "MergeConflictError";
  constructor(
    message: string,
    readonly conflicts: string[] = [],
  ) {
    super(message, [
      {tool_name: "git_status", description: "Run git_status to see the conflicting files."},
      {tool_name: "git_add", description: "After resolving conflicts, use `git_add` on the resolved files to mark them as resolved."},
      {tool_name: "git_commit", description: "Once all conflicts are resolved and staged, run `git_commit` to complete the merge."},
    ]);
  }
}

export class RebaseConflictError extends McpToolError {
  override readonly name = "RebaseConflictError";
  constructor(message: string) {
    super(message, [
      {tool_name: "git_status", description: "Run git_status to see the conflicting files and rebase status."},
      {tool_name: "git_add", description: "After resolving, use `git_add` on the resolved files."},
      {tool_name: "git_rebase", description: "Run `git_rebase --continue` (tool support pending) to proceed."},
      {tool_name: "git_rebase", description: "Run `git_rebase --abort` (tool support pending) to cancel."},
    ]);
  }
}

export const handleToolError = (toolName: string, error: unknown) => {
  if (
    error instanceof MergeConflictError ||
    error instanceof RebaseConflictError ||
    error instanceof InvalidRepoError ||
    error instanceof EmptyCommitError ||
    error instanceof GitCommandError ||
    error instanceof Error
  ) {
    return returnError(`Error in tool '${toolName}': ${error.message}`, error);
  }

  const errorMessage = String(error);
  let errorDetail = {json: "", string: errorMessage};
  try {
    errorDetail.json = JSON.stringify(error, null, 2);
  } catch {}

  return returnError(`Error in tool '${toolName}': ${errorMessage}`, {
    name: "UnknownError",
    message: JSON.stringify(errorDetail),
  });
};
