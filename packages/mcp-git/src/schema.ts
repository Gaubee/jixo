import {z} from "zod";

// --- Base Schemas ---

const GenericErrorSchema = {
  error: z
    .object({
      name: z.string().describe("The type of error, e.g., 'InvalidRepoError'."),
      message: z.string().describe("A detailed description of what went wrong."),
      remedy_tool_suggestions: z
        .array(
          z.object({
            tool_name: z.string(),
            description: z.string(),
          }),
        )
        .optional()
        .describe("Suggested tools to run to fix the error."),
      conflicts: z.array(z.string()).optional().describe("A list of files with merge conflicts."),
    })
    .optional()
    .describe("Included only when 'success' is false."),
};

const BaseSuccessSchema = {
  success: z.boolean().describe("Indicates if the operation was successful."),
};

// --- Output Schemas for specific tools ---

const FileStatusSchema = z.object({
  path: z.string(),
  indexStatus: z.string().describe("Status in the index/staging area (e.g., 'Unmodified', 'Modified', 'Added', 'Deleted')."),
  workingDirStatus: z.string().describe("Status in the working directory (e.g., 'Unmodified', 'Modified', 'Untracked')."),
});

export const GitStatusOutputSchema = {
  ...BaseSuccessSchema,
  ...GenericErrorSchema,
  current: z.string().optional().describe("Current branch name."),
  tracking: z.string().nullable().optional().describe("Tracking branch name."),
  ahead: z.number().optional().describe("Number of commits ahead of the tracking branch."),
  behind: z.number().optional().describe("Number of commits behind the tracking branch."),
  files: z.array(FileStatusSchema).optional().describe("List of files with their semantic status."),
  isClean: z.boolean().optional().describe("True if the working directory is clean."),
};

const CommitSchema = z.object({
  hash: z.string(),
  date: z.string(),
  message: z.string(),
  author_name: z.string(),
  author_email: z.string(),
});

export const GitLogOutputSchema = {
  ...BaseSuccessSchema,
  ...GenericErrorSchema,
  commits: z.array(CommitSchema).optional().describe("An array of commit objects."),
};

export const GitCommitOutputSchema = {
  ...BaseSuccessSchema,
  ...GenericErrorSchema,
  message: z.string().optional(),
  commitHash: z.string().optional().describe("The hash of the newly created commit."),
};

export const DiffOutputSchema = {
  ...BaseSuccessSchema,
  ...GenericErrorSchema,
  diff: z.string().optional().describe("The git diff output."),
};

export const SuccessOutputSchema = {
  ...BaseSuccessSchema,
  ...GenericErrorSchema,
  message: z.string().optional(),
};

const WorktreeSchema = z.object({
  path: z.string(),
  branch: z.string(),
  isCurrent: z.boolean(),
  isMain: z.boolean(),
});

export const GitWorktreeListOutputSchema = {
  ...BaseSuccessSchema,
  ...GenericErrorSchema,
  worktrees: z.array(WorktreeSchema).optional().describe("A list of all worktrees for the repository."),
};

export const MergeOutputSchema = {
  ...BaseSuccessSchema,
  ...GenericErrorSchema,
  message: z.string().optional().describe("A summary of the merge result."),
  mergedBranches: z.array(z.string()).optional().describe("List of branches that were merged."),
};

const StashEntrySchema = z.object({
  hash: z.string(),
  refs: z.array(z.string()),
  message: z.string(),
});

export const GitStashListOutputSchema = {
  ...BaseSuccessSchema,
  ...GenericErrorSchema,
  stashes: z.array(StashEntrySchema).optional().describe("A list of stashed changesets."),
};

// --- Tool Input Schemas ---
export const RepoPathArgSchema = {
  repoPath: z.string().describe("Path to the Git repository or any of its worktrees."),
};

export const GitStatusArgsSchema = RepoPathArgSchema;
export const GitDiffUnstagedArgsSchema = RepoPathArgSchema;
export const GitDiffStagedArgsSchema = RepoPathArgSchema;
export const GitDiffArgsSchema = {
  ...RepoPathArgSchema,
  target: z.string().describe("Target to compare with. Can be a branch name, commit hash, or a range like 'branch1..branch2'."),
};
export const GitCommitArgsSchema = {
  ...RepoPathArgSchema,
  message: z.string().describe("The commit message."),
};
export const GitAddArgsSchema = {
  ...RepoPathArgSchema,
  files: z.array(z.string()).min(1).describe("An array of file paths, directory paths, or patterns to stage (e.g., ['src/main.js', 'docs/', '*.md'])."),
};
export const GitResetArgsSchema = RepoPathArgSchema;
export const GitLogArgsSchema = {
  ...RepoPathArgSchema,
  maxCount: z.number().int().min(1).default(10).optional().describe("Maximum number of commits to show."),
};
export const GitCreateBranchArgsSchema = {
  ...RepoPathArgSchema,
  branchName: z.string().describe("Name for the new branch."),
  baseBranch: z.string().optional().describe("The starting point for the new branch (e.g., 'main' or a commit hash). Defaults to the current HEAD."),
};
export const GitCheckoutArgsSchema = {
  ...RepoPathArgSchema,
  branchName: z.string().describe("Name of the branch to switch to."),
};
export const GitShowArgsSchema = {
  ...RepoPathArgSchema,
  revision: z.string().describe("The revision to show (commit hash, branch name, tag, etc.)."),
};
export const GitInitArgsSchema = {
  repoPath: z.string().describe("Path to the directory to initialize the git repo in."),
};
export const GitCloneArgsSchema = {
  source: z.string().describe("The remote repository URL to clone from."),
  local: z.string().describe("The local directory path to clone into."),
};
export const GitWorktreeAddArgsSchema = {
  ...RepoPathArgSchema,
  path: z.string().describe("The directory path for the new worktree."),
  branch: z.string().describe("The name of the branch for the new worktree."),
  createBranch: z.boolean().optional().default(false).describe("If true, creates a new branch named after the 'branch' argument."),
};
export const GitWorktreeListArgsSchema = RepoPathArgSchema;
export const GitWorktreeRemoveArgsSchema = {
  ...RepoPathArgSchema,
  path: z.string().describe("The path of the worktree to remove."),
};
export const GitMergeArgsSchema = {
  ...RepoPathArgSchema,
  branch: z.string().describe("The name of the branch to merge into the current branch."),
};
export const GitRebaseArgsSchema = {
  ...RepoPathArgSchema,
  baseBranch: z.string().describe("The branch onto which the current branch will be rebased."),
};
export const GitTagArgsSchema = {
  ...RepoPathArgSchema,
  tagName: z.string().describe("The name of the tag to create (e.g., 'v1.0.0')."),
  message: z.string().optional().describe("If provided, creates an annotated tag with this message. Otherwise, creates a lightweight tag."),
};
export const GitStashPushArgsSchema = {
  ...RepoPathArgSchema,
  message: z.string().optional().describe("An optional message to describe the stash."),
};
export const GitStashListArgsSchema = RepoPathArgSchema;
export const GitStashPopArgsSchema = {
  ...RepoPathArgSchema,
  index: z.number().int().min(0).optional().describe("The index of the stash to pop (e.g., 0 for stash@{0}). Defaults to the latest stash."),
};
