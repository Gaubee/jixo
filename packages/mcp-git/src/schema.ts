import {z} from "zod";

// --- Base Schemas ---

const GenericErrorSchema = {
  error: z
    .object({
      name: z.string().describe("The type of error, e.g., 'InvalidRepoError'."),
      message: z.string().describe("A detailed description of what went wrong."),
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

// --- Tool Input Schemas ---
export const RepoPathArgSchema = {
  repoPath: z.string().describe("Path to the Git repository."),
};
export const GitStatusArgsSchema = RepoPathArgSchema;
export const GitDiffUnstagedArgsSchema = RepoPathArgSchema;
export const GitDiffStagedArgsSchema = RepoPathArgSchema;
export const GitDiffArgsSchema = {
  ...RepoPathArgSchema,
  target: z.string().describe("Target branch or commit to compare with."),
};
export const GitCommitArgsSchema = {
  ...RepoPathArgSchema,
  message: z.string().describe("Commit message."),
};
export const GitAddArgsSchema = {
  ...RepoPathArgSchema,
  files: z.array(z.string()).min(1).describe("Array of file paths to stage."),
};
export const GitResetArgsSchema = RepoPathArgSchema;
export const GitLogArgsSchema = {
  ...RepoPathArgSchema,
  maxCount: z.number().int().min(1).optional().default(10).describe("Maximum number of commits to show."),
};
export const GitCreateBranchArgsSchema = {
  ...RepoPathArgSchema,
  branchName: z.string().describe("Name of the new branch."),
  baseBranch: z.string().optional().describe("Starting point for the new branch (branch name or commit hash)."),
};
export const GitCheckoutArgsSchema = {
  ...RepoPathArgSchema,
  branchName: z.string().describe("Name of the branch to checkout."),
};
export const GitShowArgsSchema = {
  ...RepoPathArgSchema,
  revision: z.string().describe("The revision (commit hash, branch name, tag) to show."),
};
export const GitInitArgsSchema = {
  repoPath: z.string().describe("Path to the directory to initialize the git repo in."),
};
