import {z} from "zod";

// --- Reusable Schemas ---
export const CommonSuccessMsgSchema = {
  path: z.string().optional().describe("The path that was operated on."),
  source: z.string().optional().describe("The source path for a move or copy operation."),
  destination: z.string().optional().describe("The destination path for a move or copy operation."),
  message: z.string().optional().describe("A summary of the successful operation."),
};

// --- Input Schemas ---
export const ReadFileArgsSchema = {path: z.string().describe("The full path to the file to read.")};
export const WriteFileArgsSchema = {
  path: z.string().describe("The full path to the file to write."),
  content: z.string().describe("The content to write to the file."),
};
export const EditFileArgsSchema = {
  path: z.string().describe("The path to the file to edit."),
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
  path: z.string().describe("The path to the directory to list."),
  maxDepth: z.number().int().min(1).default(1).optional().describe("Maximum depth for listing. Default is 1 (flat listing). Values > 1 produce a recursive tree."),
};
export const CreateDirectoryArgsSchema = {path: z.string().describe("The path to the directory to create (recursively).")};
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

// --- Output Schemas (for Success states) ---
export const ReadFileOutputSuccessSchema = {
  path: z.string(),
  content: z.string(),
};

export const EditFileOutputSuccessSchema = {
  path: z.string(),
  changesApplied: z.boolean(),
  diff: z.string().nullable(),
  newContent: z.string().optional().nullable(),
  message: z.string(),
};

const DirectoryEntrySchema: z.ZodType<{
  name: string;
  type: "file" | "directory";
  children?: any[];
}> = z.lazy(() =>
  z.object({
    name: z.string(),
    type: z.enum(["file", "directory"]),
    children: z.array(DirectoryEntrySchema).optional(),
  }),
);
export const ListDirectoryOutputSuccessSchema = {
  path: z.string(),
  entries: z.array(DirectoryEntrySchema).describe("A list of files and directories. If maxDepth > 1, directories will contain a nested 'children' list."),
};

export const SearchFilesOutputSuccessSchema = {
  path: z.string(),
  pattern: z.string(),
  matches: z.array(z.string()),
};

export const FileInfoOutputSuccessSchema = {
  path: z.string(),
  type: z.enum(["file", "directory", "other"]),
  size: z.number(),
  permissions: z.string(),
  created: z.string().datetime(),
  modified: z.string().datetime(),
};

export const ListAllowedDirectoriesOutputSuccessSchema = {
  directories: z.array(z.string()),
};
