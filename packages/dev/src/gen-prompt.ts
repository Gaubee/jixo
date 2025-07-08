process.removeAllListeners("warning");

import {blue, createResolverByRootFile, cwdResolver, green, normalizeFilePath} from "@gaubee/nodekit";
import parcelWatcher from "@parcel/watcher";
import {parseArgs} from "@std/cli/parse-args";
import {globbySync} from "globby";
import {import_meta_ponyfill} from "import-meta-ponyfill";
import {readFileSync, statSync, watch, writeFileSync} from "node:fs";
import path from "node:path";
import {Signal} from "signal-polyfill";
import {effect} from "signal-utils/subtle/microtask-effect";
import {simpleGit, type SimpleGit} from "simple-git";

const getFileState = (filepath: string, once: boolean) => {
  const fileState = new Signal.State(readFileSync(filepath, "utf-8"));
  if (!once) {
    const off = effect(() => {
      const watcher = watch(filepath, () => {
        try {
          fileState.set(readFileSync(filepath, "utf-8"));
        } catch {
          watcher.close();
          off();
        }
      });
    });
  }
  return fileState;
};

const dirGLobState = (dirname: string, glob: string, once: boolean) => {
  const dirState = new Signal.State(globbySync(glob, {cwd: dirname}), {
    equals(t, t2) {
      return t.length === t2.length && t.every((file, i) => file === t2[i]);
    },
  });
  if (!once) {
    const off = effect(async () => {
      const sub = await parcelWatcher.subscribe(dirname, (err, events) => {
        if (events.some((event) => event.type === "create" || event.type === "delete")) {
          try {
            dirState.set(globbySync(glob, {cwd: dirname}));
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
      const status = await gitInstance.status([filePath]);
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
 * Processes a single replacement based on the mode (GIT_DIFF, GIT_FILES, FILE, INJECT).
 * This function is designed to be called for each regex match found in the input content.
 * @param _ The full matched string (e.g., "[./path/to/file](@GIT_DIFF)").
 * @param glob_or_filepath The path or glob pattern from the matched string.
 * @param mode The mode (e.g., "GIT_DIFF", "GIT_FILES", "FILE", "INJECT").
 * @param once Whether the processing should happen only once (for watcher logic).
 * @returns The replacement string for the matched placeholder.
 */
const processReplacement = async (
  _: string,
  glob_or_filepath: string,
  mode: string,
  once: boolean,
  rootResolver: (filepath: string) => string,
  baseDir: string, // New parameter for globby cwd
): Promise<string> => {
  if (glob_or_filepath.startsWith("`")) {
    glob_or_filepath = glob_or_filepath.slice(1, -1);
  }
  glob_or_filepath = normalizeFilePath(glob_or_filepath);
  mode = mode.toUpperCase().replaceAll("-", "_").trim();

  const git = simpleGit({baseDir}); // Initialize simpleGit with the correct base directory

  if (mode === "GIT_DIFF" || mode === "GIT_FILES") {
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
      /**
       * @TODO
       * 这里的代码 实现有问题，不该先进行 globbySync
       *
       * 而是应该先基于 commitHash，然后列出文件列表，再基于列出的文件列表，去做 glob 匹配。
       */
      // Use globby to find files matching the pattern within the specified baseDir
      const filesToProcess = globbySync(filePattern, {cwd: baseDir});

      if (filesToProcess.length === 0) {
        return `<!-- No files found for pattern: ${filePattern} -->`;
      }

      for (const filepath of filesToProcess) {
        const fullFilepath = rootResolver(filepath);
        // Ensure it's a file, not a directory
        if (!statSync(fullFilepath).isFile()) {
          continue;
        }

        if (mode === "GIT_DIFF") {
          let diffContent: string;
          if (commitHash) {
            // Get diff between the specified commit and its parent for the given file
            diffContent = await git.diff([`${commitHash}~1`, commitHash, "--", filepath]);
          } else {
            // Get diff for unstaged changes of a specific file in the working directory
            diffContent = await git.diff(["--", filepath]);
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
        } else if (mode === "GIT_FILES") {
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
    console.log(`DEBUG: processReplacement (GIT mode) returning:\n${result}`);
    return result;
  }

  // Handle FILE and INJECT modes (existing logic)
  const files = globbySync(glob_or_filepath);
  if (files.length === 0) {
    console.log(`DEBUG: processReplacement (FILE/INJECT mode) returning original placeholder: ${_}`);
    return _;
  }
  const lines: string[] = [];
  for (const filepath of globbySync(glob_or_filepath)) {
    const fullFilepath = rootResolver(filepath);
    if (!statSync(fullFilepath).isFile()) {
      continue;
    }
    const fileContent = getFileState(fullFilepath, once).get();
    if (mode === "FILE") {
      const split = fileContent.includes("```") ? "````" : "```";
      lines.push(
        //
        "",
        filepath,
        split + path.parse(filepath).ext.slice(1),
        fileContent,
        split,
        "",
      );
    } else if (mode === "INJECT") {
      lines.push(fileContent);
    } else {
      lines.push(`<!-- unknown mode ${mode} -->`);
    }
  }
  const result = lines.join("\n");
  console.log(`DEBUG: processReplacement (FILE/INJECT mode) returning:\n${result}`);
  return result;
};

export const gen_prompt = async (input: string, once: boolean, _output?: string) => {
  console.log(blue("gen_prompt"), input);
  const output = _output ? cwdResolver(_output) : input.replace(/\.md$/, ".gen.md");
  let inputContent = getFileState(input, once).get();

  const regex = /\[(.+?)\]\(@([\w-:]+)\)/g;
  const matches = [...inputContent.matchAll(regex)];

  // Create a root resolver based on the input file's directory
  const currentRootResolver = createResolverByRootFile(input, ".git");

  // Collect all promises for replacements
  const replacementPromises = matches.map(async (match) => {
    const [, glob_or_filepath, mode] = match;
    return processReplacement(match[0], glob_or_filepath, mode, once, currentRootResolver, path.dirname(input));
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

const gen_prompts = (dirname: string, once: boolean, glob = "*.meta.md") => {
  console.log(blue("gen_prompts"), dirname, glob);
  for (const filename of dirGLobState(dirname, glob, once).get()) {
    gen_prompt(path.join(dirname, filename), once);
  }
};

if (import_meta_ponyfill(import.meta).main) {
  const args = parseArgs(process.argv.slice(2), {
    string: ["outFile", "glob"],
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
