import type {FileStatusResult, StatusResult} from "simple-git";

/**
 * A mapping from git status codes to human-readable, semantic strings.
 */
export const gitStatusMap: Record<string, string> = {
  " ": "Unmodified",
  M: "Modified",
  A: "Added",
  D: "Deleted",
  R: "Renamed",
  C: "Copied",
  U: "Unmerged",
  "?": "Untracked",
};

/**
 * Converts a raw file status object from simple-git into our semantic format.
 * @param file - The raw file status object.
 * @returns An object with human-readable status strings.
 */
function toSemanticFile(file: FileStatusResult) {
  return {
    path: file.from ? `${file.from} -> ${file.path}` : file.path,
    indexStatus: gitStatusMap[file.index] || file.index,
    workingDirStatus: gitStatusMap[file.working_dir] || file.working_dir,
  };
}

/**
 * Generates a human-readable summary string from a StatusResult object, similar to `git status`.
 * @param status - The StatusResult object from simple-git.
 * @returns A formatted string for display.
 */
export function formatStatus(status: StatusResult): string {
  const output: string[] = [];
  output.push(`On branch ${status.current}`);
  if (status.tracking) {
    if (status.ahead > 0 && status.behind > 0) {
      output.push(`Your branch and '${status.tracking}' have diverged,`);
      output.push(`and have ${status.ahead} and ${status.behind} different commits each, respectively.`);
    } else if (status.ahead > 0) {
      output.push(`Your branch is ahead of '${status.tracking}' by ${status.ahead} commit(s).`);
    } else if (status.behind > 0) {
      output.push(`Your branch is behind '${status.tracking}' by ${status.behind} commit(s).`);
    } else {
      output.push(`Your branch is up to date with '${status.tracking}'.`);
    }
  }

  const stagedFiles = status.files.filter((f) => f.index !== " " && f.index !== "?");
  if (stagedFiles.length > 0) {
    output.push("\nChanges to be committed:");
    stagedFiles.forEach((file) => output.push(`\t${(toSemanticFile(file).indexStatus + ":").padEnd(12)}${toSemanticFile(file).path}`));
  }

  const notStagedFiles = status.files.filter((f) => f.working_dir !== " " && f.working_dir !== "?");
  if (notStagedFiles.length > 0) {
    output.push("\nChanges not staged for commit:");
    notStagedFiles.forEach((file) => {
      output.push(`\t${(toSemanticFile(file).workingDirStatus + ":").padEnd(12)}${file.path}`);
    });
  }

  const untrackedFiles = status.files.filter((f) => f.index === "?" && f.working_dir === "?");
  if (untrackedFiles.length > 0) {
    output.push("\nUntracked files:");
    untrackedFiles.forEach((file) => output.push(`\t${file.path}`));
  }

  if (status.isClean()) {
    output.push("\nnothing to commit, working tree clean");
  }
  return output.join("\n").trim();
}

/**
 * Transforms the raw file list from simple-git's status into a semantic format for structured output.
 * @param statusFiles - The array of FileStatusResult from simple-git.
 * @returns An array of files with semantic, human-readable statuses.
 */
export function getSemanticFiles(statusFiles: FileStatusResult[]) {
  return statusFiles.map(toSemanticFile);
}
