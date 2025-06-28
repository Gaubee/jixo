import {z} from "zod";

// --- Base Schemas for Composition ---
const BaseSuccessPayloadSchema = {
  message: z.string().optional().describe("A summary of the successful operation."),
};

const SinglePathSuccessSchema = {
  ...BaseSuccessPayloadSchema,
  path: z.string().describe("The absolute path that was operated on."),
};

// --- Input Schemas ---
export const ReadFileArgsSchema = {path: z.string().describe("The path to the file to read (can be relative, absolute, or use a drive letter like '$A/file.txt').")};
export const WriteFileArgsSchema = {
  path: z.string().describe("The path to the file to write (can be relative, absolute, or use a drive letter like '$A/file.txt')."),
  content: z.string().describe("The content to write to the file."),
};
export const EditFileArgsSchema = {
  path: z.string().describe("The path to the file to edit (can be relative, absolute, or use a drive letter like '$A/file.txt')."),
  edits: z
    .array(z.object({oldText: z.string(), newText: z.string()}))
    .min(1)
    .describe("A list of search-and-replace operations."),
  dryRun: z.boolean().default(false).optional().describe("If true, returns the diff without modifying the file."),
  returnStyle: z
    .enum(["diff", "full", "none"])
    .default("diff")
    .optional()
    .describe("Controls what content is returned after a successful edit. 'diff' (default) for a patch, 'full' for the new content, 'none' for just a success message."),
};
export const ListDirectoryArgsSchema = {
  path: z.string().describe("The path to the directory to list (can be relative, absolute, or use a drive letter like '$A/dir')."),
  maxDepth: z.number().int().min(1).default(1).optional().describe("Maximum depth for listing. Default is 1 (flat listing). Values > 1 produce a recursive tree."),
};
export const CreateDirectoryArgsSchema = {path: z.string().describe("The path to the directory to create (recursively; can be relative, absolute, or use a drive letter).")};
export const MoveFileArgsSchema = {
  source: z.string().describe("The source path of the file or directory to move."),
  destination: z.string().describe("The destination path."),
};
export const CopyPathArgsSchema = {
  source: z.string().describe("The path of the file or directory to copy."),
  destination: z.string().describe("The path where the copy will be created. If the destination is an existing directory, the source will be copied inside it."),
  recursive: z.boolean().default(false).optional().describe("If true, allows copying directories recursively. Required for directories."),
};
export const DeletePathArgsSchema = {
  path: z.string().describe("The path of the file or directory to delete."),
  recursive: z.boolean().default(false).optional().describe("If true, allows deleting directories and their contents recursively. Required for non-empty directories."),
};
export const SearchFilesArgsSchema = {
  path: z.string().describe("The root directory to start the search from."),
  pattern: z.string().describe("A case-insensitive substring to search for in file/directory names."),
  excludePatterns: z.array(z.string()).default([]).optional().describe("A list of glob patterns to exclude (e.g., 'node_modules', '*.log')."),
};
export const GetFileInfoArgsSchema = {path: z.string().describe("The path to the file or directory to get info for.")};
export const ListAllowedDirectoriesArgsSchema = {};
export const GetCwdArgsSchema = {};
export const SetCwdArgsSchema = {path: z.string().describe("The path to set as the new current working directory.")};
export const ListMountsArgsSchema = {};

// --- Output Schemas (for Success states) ---
export const ReadFileOutputSuccessSchema = {
  path: z.string().describe("The absolute path of the file that was read."),
  content: z.string().describe("The full content of the file."),
};

export const WriteFileSuccessSchema = {
  ...SinglePathSuccessSchema,
  path: z.string().describe("The absolute path of the file that was written to."),
};

export const EditFileOutputSuccessSchema = {
  path: z.string().describe("The absolute path of the file that was edited."),
  changesApplied: z.boolean().describe("Whether any changes were made to the file."),
  diff: z.string().optional().describe("A git-style diff of the changes, or null if no changes were made."),
  newContent: z.string().optional().describe("The full new content of the file, if 'returnStyle' was 'full'."),
  message: z.string().describe("A summary of the edit operation."),
};

export type DirectoryEntryData = {
  name: string;
  type: "file" | "directory";
  children?: DirectoryEntryData[];
};

const DirectoryEntrySchema: z.ZodType<DirectoryEntryData> = z.object({
  name: z.string(),
  type: z.enum(["file", "directory"]),
  children: z.array(z.lazy(() => DirectoryEntrySchema)).optional(),
});

export const ListDirectoryOutputSuccessSchema = {
  path: z.string().describe("The absolute path of the directory that was listed."),
  entries: z.array(DirectoryEntrySchema).describe("A list of files and directories. If maxDepth > 1, directories will contain a nested 'children' list."),
};

export const CreateDirectorySuccessSchema = {
  ...SinglePathSuccessSchema,
  path: z.string().describe("The absolute path of the directory that was created."),
};

export const MoveFileSuccessSchema = {
  ...BaseSuccessPayloadSchema,
  source: z.string().describe("The absolute source path of the item that was moved."),
  destination: z.string().describe("The absolute destination path."),
};

export const CopyPathSuccessSchema = {
  ...BaseSuccessPayloadSchema,
  source: z.string().describe("The absolute source path of the item that was copied."),
  destination: z.string().describe("The absolute destination path of the new copy."),
};

export const DeletePathSuccessSchema = {
  ...SinglePathSuccessSchema,
  path: z.string().describe("The absolute path of the item that was deleted."),
};

export const SearchFilesOutputSuccessSchema = {
  path: z.string().describe("The absolute path of the directory that was searched."),
  pattern: z.string().describe("The search pattern that was used."),
  matches: z.array(z.string()).describe("A list of absolute paths matching the pattern."),
};

export const FileInfoOutputSuccessSchema = {
  path: z.string().describe("The absolute path of the file or directory."),
  type: z.enum(["file", "directory", "other"]).describe("The type of the item."),
  size: z.number().describe("The size of the item in bytes."),
  permissions: z.string().describe("The octal permission string for the item."),
  created: z.string().datetime().describe("The creation timestamp in ISO 8601 format."),
  modified: z.string().datetime().describe("The last modification timestamp in ISO 8601 format."),
};

export const ListAllowedDirectoriesOutputSuccessSchema = {
  directories: z.array(z.string()).describe("A list of absolute paths the server is allowed to access."),
};

export const GetCwdOutputSuccessSchema = {
  cwd: z.string().describe("The absolute path of the current working directory."),
};

export const SetCwdSuccessSchema = {
  ...BaseSuccessPayloadSchema,
  newCwd: z.string().describe("The new absolute path of the current working directory."),
};

const MountPointSchema = z.object({
  drive: z.string().optional().describe("The assigned drive letter (e.g., '$A', '$B')."),
  path: z.string().describe("The real, absolute path of the mount point."),
  permissions: z.string().describe("The assigned permissions ('R', 'W', 'RW')."),
});

export const ListMountsOutputSuccessSchema = {
  mounts: z.array(MountPointSchema).describe("A list of all configured mount points."),
  cwd: z.string().describe("The absolute path of the current working directory."),
};
