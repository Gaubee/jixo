process.removeAllListeners("warning");

import {blue, createResolver, createResolverByRootFile, cwdResolver, green, normalizeFilePath} from "@gaubee/nodekit";
import parcelWatcher from "@parcel/watcher";
import {parseArgs} from "@std/cli/parse-args";
import {globbySync} from "globby";
import {import_meta_ponyfill} from "import-meta-ponyfill";
import micromatch from "micromatch"; // Import micromatch
import {readFileSync, statSync, watch, writeFileSync} from "node:fs";
import {cpus} from "node:os";
import path from "node:path";
import {Signal} from "signal-polyfill";
import {effect} from "signal-utils/subtle/microtask-effect";
import {simpleGit, type SimpleGit} from "simple-git";

const parseParams = (paramString: string): Record<string, string | boolean | string[]> => {
  const params: Record<string, string | boolean | string[]> = {};
  if (!paramString) {
    return params;
  }
  const searchParams = new URLSearchParams(paramString);
  for (const [key, value] of searchParams.entries()) {
    if (key === "ignore") {
      // Special handling for 'ignore' parameter
      params[key] = value.split(",").map((item) => item.trim()); // Always treat as array of strings
    } else if (value.toLowerCase() === "true") {
      params[key] = true;
    } else if (value.toLowerCase() === "false") {
      params[key] = false;
    } else if (value.includes(",")) {
      params[key] = value.split(",").map((item) => item.trim());
    } else {
      params[key] = value;
    }
  }
  return params;
};

const getFileState = (filepath: string, once: boolean) => {
  const fileState = new Signal.State(readFileSync(filepath, "utf-8"));
  if (!once) {
    const off = effect(() => {
      const watcher = watch(filepath, () => {
        try {
          fileState.set(readFileSync(filepath, "utf-8"));
        } catch (error) {
          watcher.close();
          off();
        }
      });
    });
  }
  return fileState;
};

const dirGLobState = (dirname: string, glob: string, once: boolean) => {
  const dirState = new Signal.State(globbySync(glob, {cwd: dirname}).map(String), {
    equals(t, t2) {
      return t.length === t2.length && t.every((file, i) => file === t2[i]);
    },
  });
  if (!once) {
    const off = effect(async () => {
      const sub = await parcelWatcher.subscribe(dirname, (err, events) => {
        if (events.some((event) => event.type === "create" || event.type === "delete")) {
          try {
            dirState.set(globbySync(glob, {cwd: dirname}).map(String));
          } catch {
            sub.unsubscribe();
            off();
          }
        }
      });
    });
  }
  return dirState;
};

interface FileTreeNode {
  children: Map<string, FileTreeNode>;
  isFile?: boolean;
}

// Helper to build the tree recursively
const buildTree = (
  node: FileTreeNode,
  indentation: string, // This is the accumulated indentation for the current node's children
  outputLines: string[],
  expandDirectories: boolean,
) => {
  const sortedChildren = Array.from(node.children.keys()).sort((a, b) => {
    const aIsFile = node.children.get(a)?.isFile || false;
    const bIsFile = node.children.get(b)?.isFile || false;
    if (aIsFile === bIsFile) return a.localeCompare(b);
    return aIsFile ? 1 : -1; // Directories first
  });

  sortedChildren.forEach((childName, index) => {
    const isLastChild = index === sortedChildren.length - 1;
    const childNode = node.children.get(childName)!;
    const branchSymbol = isLastChild ? "└── " : "├── ";

    outputLines.push(`${indentation}${branchSymbol}${childName}`);

    const nextIndentation = indentation + (isLastChild ? "    " : "│   ");

    if (childNode.children.size > 0 && expandDirectories) {
      buildTree(childNode, nextIndentation, outputLines, expandDirectories);
    }
  });
};

// Helper to generate a file tree structure
const generateFileTree = (files: string[], expandDirectories: boolean = true): string => {
  if (files.length === 0) {
    return "";
  }

  const root: FileTreeNode = {children: new Map()};

  // Build the hierarchical structure
  files.forEach((file) => {
    const parts = file.split(path.sep);
    let current: FileTreeNode = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isFilePart = i === parts.length - 1;

      if (!current.children.has(part)) {
        current.children.set(part, {children: new Map(), isFile: isFilePart});
      }
      const nextNode = current.children.get(part)!;

      // If expandDirectories is false, and this is a directory part,
      // we only add the top-level directory and do not descend further for this path.
      if (!expandDirectories && !isFilePart) {
        // Ensure that the directory itself is added, but no children are populated
        nextNode.children = new Map();
        break; // Stop processing further parts of this file path
      }
      current = nextNode;
    }
  });

  const outputLines: string[] = [];
  const sortedRootChildren = Array.from(root.children.keys()).sort((a, b) => {
    const aIsFile = root.children.get(a)?.isFile || false;
    const bIsFile = root.children.get(b)?.isFile || false;
    if (aIsFile === bIsFile) return a.localeCompare(b);
    return aIsFile ? 1 : -1; // Directories first
  });

  sortedRootChildren.forEach((childName, index) => {
    const isLastChild = index === sortedRootChildren.length - 1;
    const childNode = root.children.get(childName)!;
    const branchSymbol = isLastChild ? "└── " : "├── ";
    outputLines.push(`${branchSymbol}${childName}`);

    // Only recurse if childNode is a directory and expandDirectories is true
    if (childNode.children.size > 0 && expandDirectories) {
      const nextPrefix = isLastChild ? "    " : "│   ";
      buildTree(childNode, nextPrefix, outputLines, expandDirectories);
    }
  });

  return outputLines.join("\n");
};

/**
 * Retrieves file content from a Git repository.
 * If a commit hash is provided, it fetches the file content at that specific commit.
 * Otherwise, it attempts to read the file from the working directory,
 * or from the Git index if it's staged but not in the working directory.
 * @param gitInstance The simple-git instance.
 * @param filePath The path to the file.
 * @param commitHash Optional commit hash.
 * @returns The file content as a string, or null if an error occurs or content is not found.
 */
const getFileContentFromGit = async (
  gitInstance: SimpleGit,
  filePath: string,
  baseDir: string, // Add baseDir here
  commitHash?: string,
): Promise<string | null> => {
  try {
    if (commitHash) {
      // Fetch file content at a specific commit
      return await gitInstance.show([`${commitHash}:${filePath}`]);
    } else {
      // Check file status to determine if it's staged or only in working directory
      const status = await gitInstance.status();
      if (status.files.some((f) => f.path === filePath && f.index !== " " && f.working_dir === " ")) {
        // File is staged but not present in working directory (e.g., deleted or moved)
        // Get content from the Git index
        return await gitInstance.show([`:${filePath}`]);
      } else {
        // Read directly from the working directory for unstaged or unmodified files
        return readFileSync(path.join(baseDir, filePath), "utf-8");
      }
    }
  } catch (error: unknown) {
    console.error(`Error getting file content for ${filePath} at commit ${commitHash || "HEAD"}:`, error);
    return null;
  }
};

/**
 * Processes a single replacement based on the mode (GIT_DIFF, GIT_FILE, FILE, INJECT, FILE_TREE).
 * This function is designed to be called for each regex match found in the input content.
 * @param _ The full matched string (e.g., "[./path/to/file](@GIT_DIFF)").
 * @param glob_or_filepath The path or glob pattern from the matched string.
 * @param modeWithParams The mode (e.g., "GIT_DIFF", "FILE?gitignore=true").
 * @param once Whether the processing should happen only once (for watcher logic).
 * @returns The replacement string for the matched placeholder.
 */
const processReplacement = async (
  _: string,
  glob_or_filepath: string,
  mode: string,
  paramString: string | undefined,
  once: boolean,
  rootResolver: (filepath: string) => string,
  baseDir: string, // New parameter for globby cwd
): Promise<string> => {
  if (glob_or_filepath.startsWith("`")) {
    glob_or_filepath = glob_or_filepath.slice(1, -1);
  }
  glob_or_filepath = normalizeFilePath(glob_or_filepath);

  const params = parseParams(paramString || ""); // Changed to parseParams
  const normalizedMode = mode.toUpperCase().replaceAll("-", "_").trim();

  const git = simpleGit({baseDir, maxConcurrentProcesses: cpus().length}); // Initialize simpleGit with the correct base directory

  if (normalizedMode === "GIT_DIFF" || normalizedMode === "GIT_FILE") {
    let commitHash: string | undefined;
    let filePattern: string;

    const parts = glob_or_filepath.split(":");
    if (parts.length > 1) {
      commitHash = parts[0];
      filePattern = parts.slice(1).join(":");
    } else {
      filePattern = glob_or_filepath;
    }

    const lines: string[] = [];
    try {
      let filesToProcess: string[] = [];
      if (commitHash) {
        // Get all files at the specified commit
        const allFilesInCommit = (await git.raw(["ls-tree", "-r", "--name-only", commitHash])).split("\n").filter(Boolean); // Filter out empty strings

        // Filter files based on the glob pattern using micromatch
        filesToProcess = micromatch.match(allFilesInCommit, filePattern);
      } else {
        // For both GIT_FILE and GIT_DIFF without commitHash, use git.status to list files
        const statusResult = await git.status();
        const uncommittedFiles = statusResult.files.filter((f) => f.index !== " " || f.working_dir !== " ").map((f) => f.path);
        filesToProcess = micromatch.match(uncommittedFiles, filePattern);
      }

      if (filesToProcess.length === 0) {
        return `<!-- No files found for pattern: ${filePattern} ${commitHash ? `at commit ${commitHash}` : "in working directory"} -->`;
      }

      for (const filepath of filesToProcess) {
        const fullFilepath = rootResolver(filepath); // This might not be needed if only using git commands

        if (normalizedMode === "GIT_DIFF") {
          let diffContent: string;
          if (commitHash) {
            // Get diff between the specified commit and its parent for the given file
            diffContent = await git.diff([`${commitHash}~1`, commitHash, "--", filepath]);
          } else {
            // Get status of the file to determine if it's untracked
            const statusResult = await git.status();
            const fileStatus = statusResult.files.find((f) => f.path === filepath);

            if (fileStatus && fileStatus.working_dir === "?" && fileStatus.index === "?") {
              // Untracked file: compare with /dev/null
              diffContent = await git.raw(["diff", "--no-index", "/dev/null", filepath]);
            } else {
              // Tracked file (modified, deleted, etc.): get unstaged diff
              diffContent = await git.diff(["--", filepath]);
            }
          }
          if (diffContent) {
            lines.push(
              "",
              `\`\`\`diff`, // Markdown code block for diff
              diffContent,
              `\`\`\``,
              "",
            );
          } else {
            lines.push(`<!-- No diff found for ${filepath} ${commitHash ? `at commit ${commitHash}` : "in working directory"} -->`);
          }
        } else if (normalizedMode === "GIT_FILE") {
          // Retrieve the full file content from Git
          const fileContent = await getFileContentFromGit(git, filepath, baseDir, commitHash);
          if (fileContent !== null) {
            // Determine appropriate markdown code block splitter
            const split = fileContent.includes("```") ? "````" : "```";
            lines.push(
              "",
              filepath,
              split + path.parse(filepath).ext.slice(1), // Add file extension for syntax highlighting
              fileContent,
              split,
              "",
            );
          } else {
            lines.push(`<!-- Could not retrieve content for ${filepath} ${commitHash ? `at commit ${commitHash}` : "in working directory"} -->`);
          }
        }
      }
    } catch (error: unknown) {
      console.error(`Error processing GIT mode for ${glob_or_filepath}:`, error);
      return `<!-- Error processing GIT mode for ${glob_or_filepath}: ${(error as Error).message} -->`;
    }
    const result = lines.join("\n");
    return result;
  }

  // Handle FILE, INJECT, and FILE_TREE modes
  // Pass params to globbySync. Ensure 'ignore' param is handled correctly by globby.
  const globbyOptions: Record<string, any> = {cwd: baseDir, gitignore: true};
  // Explicitly set gitignore or ignore if present in params
  if (typeof params.gitignore === "boolean") {
    globbyOptions.gitignore = params.gitignore;
  }
  // Remove gitignore from params, as we'll handle ignoring explicitly with micromatch
  delete params.gitignore;

  let ignorePatterns: string[] = [];
  if (Array.isArray(params.ignore)) {
    ignorePatterns = params.ignore;
  } else if (typeof params.ignore === "string") {
    ignorePatterns = [params.ignore];
  }
  console.log("DEBUG: globbyOptions", globbyOptions); // Added debug log
  let files = globbySync(glob_or_filepath, globbyOptions).map(String);

  // Apply ignore patterns using micromatch
  if (ignorePatterns.length > 0) {
    files = files.filter((file) => !micromatch.isMatch(file, ignorePatterns));
  }

  if (files.length === 0) {
    console.log(`DEBUG: processReplacement (${normalizedMode} mode) returning original placeholder: ${_}`);
    return `<!-- No files found for pattern: ${glob_or_filepath} -->`;
  }
  const lines: string[] = [];

  if (normalizedMode === "FILE_TREE") {
    console.log("QAQ", paramString, params);
    // Extract expandDirectories parameter
    const expandDirectories = params.expandDirectories !== false; // Default to true if not explicitly false
    lines.push("", "```", generateFileTree(files, expandDirectories), "```", "");
  } else if (normalizedMode === "FILE") {
    for (const filepath of files) {
      const fullFilepath = rootResolver(filepath);
      if (!statSync(fullFilepath).isFile()) {
        continue;
      }
      const fileContent = getFileState(fullFilepath, once).get();
      const split = fileContent.includes("```") ? "````" : "```";
      lines.push("", filepath, split + path.parse(filepath).ext.slice(1), fileContent, split, "");
    }
  } else if (normalizedMode === "INJECT") {
    for (const filepath of files) {
      const fullFilepath = rootResolver(filepath);
      if (!statSync(fullFilepath).isFile()) {
        continue;
      }
      lines.push(getFileState(fullFilepath, once).get());
    }
  } else {
    lines.push(`<!-- unknown mode ${normalizedMode} -->`);
  }

  const result = lines.join("\n");
  return result;
};

export const gen_prompt = async (input: string, once: boolean, _output?: string, cwd?: string) => {
  console.log(blue("gen_prompt"), input);
  const output = _output ? cwdResolver(_output) : input.replace(/\.md$/, ".gen.md");
  let inputContent = getFileState(input, once).get();

  const regex = /\[(.+?)\]\(@([\w-_:]+)(\?[\w=&.-]+)?\)/g; // Updated regex to capture parameters
  const matches = [...inputContent.matchAll(regex)];

  // Create a root resolver based on the input file's directory
  const currentRootResolver = cwd
    ? createResolver(cwd)
    : createResolverByRootFile(input, ".git", () => {
        const cwd = normalizeFilePath(process.cwd());
        if (input.startsWith(cwd + "/")) {
          return cwd;
        }
        return path.dirname(input);
      });

  // Collect all promises for replacements
  const replacementPromises = matches.map(async (match) => {
    const [, glob_or_filepath, mode, paramString] = match; // modeWithParams now includes potential parameters
    return processReplacement(match[0], glob_or_filepath, mode, paramString, once, currentRootResolver, currentRootResolver.dirname);
  });

  // Await all replacements
  const replacements = await Promise.all(replacementPromises);

  // Apply replacements back to the content
  let outputContent = inputContent;
  // Iterate in reverse to avoid issues with index changes
  for (let i = matches.length - 1; i >= 0; i--) {
    const match = matches[i];
    const replacement = replacements[i];
    outputContent = outputContent.substring(0, match.index!) + replacement + outputContent.substring(match.index! + match[0].length);
  }

  writeFileSync(output, outputContent);
  console.log(blue(new Date().toLocaleTimeString()), green(`✅ ${path.parse(output).name} updated`));
};

const gen_prompts = (dirname: string, once: boolean, glob = "*.meta.md", cwd?: string) => {
  console.log(blue("gen_prompts"), dirname, glob);
  for (const filename of dirGLobState(dirname, glob, once).get()) {
    gen_prompt(path.join(dirname, filename), once, undefined, cwd);
  }
};

if (import_meta_ponyfill(import.meta).main) {
  const args = parseArgs(process.argv.slice(2), {
    string: ["outFile", "glob", "cwd"],
    boolean: ["watch"],
    alias: {
      O: "outFile",
      G: "glob",
      W: "watch",
    },
  });
  if (args._.length === 0) {
    throw new Error("Please specify the input file");
  }
  let input = normalizeFilePath(cwdResolver(args._[0].toString()));
  if (input.includes("*")) {
    const parts = input.split("/");
    const index = parts.findIndex((part) => part.includes("*"));
    const dir = parts.slice(0, index).join("/") || "/";
    const glob = parts.slice(index).join("/");
    input = dir;
    args.glob = glob;
  }
  const once = !args.watch;
  const inputStat = statSync(input);
  if (inputStat.isFile()) {
    const off = effect(() => {
      gen_prompt(input, once, args.outFile);
    });
    if (once) {
      off();
    }
  } else {
    const off = effect(() => {
      gen_prompts(input, once, args.glob);
    });
    if (once) {
      off();
    }
  }
}
