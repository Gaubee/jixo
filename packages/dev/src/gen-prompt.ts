process.removeAllListeners("warning");

import {blue, createResolver, createResolverByRootFile, cwdResolver, green, matter, normalizeFilePath, readJson} from "@gaubee/nodekit";
import {func_remember, iter_map_not_null, map_get_or_put_async} from "@gaubee/util";
import {parseArgs} from "@std/cli/parse-args";
import {defaultParseSearch} from "@tanstack/router-core";
import Debug from "debug";
import {globbySync, isDynamicPattern, type Options as GlobbyOptions} from "globby";
import {import_meta_ponyfill} from "import-meta-ponyfill";
import micromatch from "micromatch"; // Import micromatch
import {mkdirSync, statSync, writeFileSync} from "node:fs";
import {cpus} from "node:os";
import path from "node:path";
import {effect} from "signal-utils/subtle/microtask-effect";
import {simpleGit} from "simple-git";
import {match, P} from "ts-pattern";
import {getCommitDiffs} from "./git-helper/getCommitDiffs.js";
import {getMultipleFileContents} from "./git-helper/getMultipleFileContents.js";
import {getWorkingCopyContents} from "./git-helper/getWorkingCopyContents.js";
import {getWorkingCopyDiffs} from "./git-helper/getWorkingCopyDiffs.js";
import {dirGlobState, getFileState} from "./reactive-fs/reactive-fs.js";
import {removeMarkdownComments} from "./utils/markdown-remove-comment.js";
export const debug = Debug("gen-prompt");
const fetchCache = new Map<string, {res: Response; text: string}>();

const projectResolver = createResolverByRootFile(import.meta.url);

const GET_JIXO_PROMPT = func_remember(() => readJson<Record<string, string>>(projectResolver("./assets/prompt.json")));

const useFileOrInject = (mode: string, filepath: string, filecontent: string, opts: {lang?: unknown; prefix?: unknown} = {}) => {
  const lines: Array<string[] | string> = [];
  const prefixStr = match(opts.prefix)
    .with(P.number, (len) => " ".repeat(len))
    .with(P.string, (str) => str)
    .otherwise(() => "");

  const contentLines = prefixStr.length ? filecontent.split("\n").map((line) => prefixStr + line) : filecontent;
  if (mode === "FILE") {
    const split = filecontent.includes("```") ? "````" : "```";
    const ext = path.parse(filepath).ext.slice(1);
    if (prefixStr.length) {
    }
    lines.push(
      prefixStr + "`" + filepath + "`",
      "",
      prefixStr +
        split +
        match(opts.lang)
          .with(P.string, (v) => v)
          .otherwise(() => ext),
      contentLines,
      prefixStr + split,
      "",
    );
  } else if (mode === "INJECT") {
    lines.push(contentLines);
  } else {
    lines.push(`<!-- unknown mode ${mode} -->`);
  }
  const result = lines.flat().join("\n");
  return result;
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

  const params = defaultParseSearch(paramString || "") as Record<string, unknown>;
  debug("processReplacement.glob_or_filepath", glob_or_filepath);
  debug("processReplacement.mode", mode);
  debug("processReplacement.params", params);

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
    filePattern = filePattern.trim();

    const lines: Array<string[] | string> = [];
    try {
      let filesToProcess: string[] = [];
      if (commitHash) {
        git.show({});
        filesToProcess = (
          await git.raw(
            iter_map_not_null(
              [
                "show",
                commitHash,
                "--pretty=",
                "--name-only",
                /// git show 自带 glob 的支持
                filePattern.trim().length > 0
                  ? // Get all files at the specified commit
                    filePattern
                  : // Filter files based on the glob pattern using micromatch
                    null,
              ],
              (v) => v,
            ),
          )
        )
          .split("\n")
          .filter(Boolean); // Filter out empty strings
        console.log("QAQ filesToProcess", filesToProcess);
      } else {
        // For both GIT_FILE and GIT_DIFF without commitHash, use git.status to list files
        const statusResult = await git.status();
        const uncommittedFiles = statusResult.files.filter((f) => f.index !== " " || f.working_dir !== " ").map((f) => f.path);
        filesToProcess = micromatch.match(uncommittedFiles, filePattern);
      }

      if (filesToProcess.length === 0) {
        return `<!-- No files found for pattern: ${filePattern} ${commitHash ? `at commit ${commitHash}` : "in working directory"} -->`;
      }

      if (commitHash && normalizedMode === "GIT_FILE") {
        const result = await getMultipleFileContents(baseDir, commitHash, filesToProcess);
        for (const item of result) {
          const ext = path.parse(item.path).ext.slice(1);
          if (item.error?.startsWith("File not found in workspace")) {
            continue;
          }

          lines.push(
            useFileOrInject("FILE", item.path, item.content ?? `<!-- ERROR: ${item.error ?? "No error message provided"} -->`, {
              prefix: params.prefix,
              lang: params[`map_ext_${ext}_lang`] ?? params.lang,
            }),
          );
        }
      } else if (commitHash && normalizedMode === "GIT_DIFF") {
        const result = await getCommitDiffs(baseDir, commitHash, filesToProcess);
        for (const item of result.files) {
          lines.push(
            useFileOrInject(
              "FILE",
              item.path +
                match(item.status)
                  .with("A", () => " (Added)")
                  .with("M", () => " (Modified)")
                  .with("D", () => " (Deleted)")
                  .with("R", () => " (Renamed)")
                  .with("T", () => " (Type Changed)")
                  .exhaustive(),
              item.diff,
              {
                prefix: params.prefix,
                lang: "diff",
              },
            ),
          );
        }
      } else if (!commitHash && normalizedMode === "GIT_DIFF") {
        const result = await getWorkingCopyDiffs(baseDir, {
          staged: match(params.staged)
            .with(P.boolean, (v) => v)
            .otherwise(() => undefined),
          filePaths: filesToProcess,
        });
        for (const item of result) {
          lines.push(
            useFileOrInject(
              "FILE",
              item.path +
                match(item.status)
                  .with("A", () => " (Added)")
                  .with("M", () => " (Modified)")
                  .with("D", () => " (Deleted)")
                  .with("R", () => " (Renamed)")
                  .with("U", () => " (Unmerged)")
                  .exhaustive(),
              item.diff,
              {
                prefix: params.prefix,
                lang: "diff",
              },
            ),
          );
        }
      } else if (!commitHash && normalizedMode === "GIT_FILE") {
        const result = await getWorkingCopyContents(baseDir, filesToProcess, {
          staged: match(params.staged)
            .with(P.boolean, (v) => v)
            .otherwise(() => undefined),
        });
        for (const item of result) {
          const ext = path.parse(item.path).ext.slice(1);
          if (item.error?.startsWith("File not found in workspace")) {
            continue;
          }

          lines.push(
            useFileOrInject("FILE", item.path, item.content ?? `<!-- ERROR: ${item.error ?? "No error message provided"} -->`, {
              prefix: params.prefix,
              lang: params[`map_ext_${ext}_lang`] ?? params.lang,
            }),
          );
        }
      } else {
        throw new Error(`mode=${normalizedMode} commitRef=${commitHash}`);
      }
    } catch (error: unknown) {
      console.error(`Error processing GIT mode for ${glob_or_filepath}:`, error);
      return `<!-- Error processing GIT mode for ${glob_or_filepath}: ${(error as Error).message} -->`;
    }
    const result = lines.flat().join("\n");
    return result;
  }

  /// Handle FILE, INJECT with internal-symbol
  if (glob_or_filepath.startsWith("jixo:")) {
    const jixo_url = new URL(glob_or_filepath);
    const filepath = (jixo_url.pathname || jixo_url.hostname).replace(/^\//, "");
    const content = GET_JIXO_PROMPT()[filepath];
    if (content) {
      return useFileOrInject(normalizedMode, filepath + ".md", content, {
        prefix: params.prefix,
        lang: params.lang,
      });
    }
    return `<!-- unknown jixo content ${filepath} -->`;
  }

  /// Handle FILE, INJECT with web-url
  if (/^https?:\/\//.test(glob_or_filepath)) {
    const url = new URL(glob_or_filepath);
    const urlRes = await map_get_or_put_async(fetchCache, url.href, async () => {
      const res = await fetch(url);
      const text = await res.text();
      return {res, text};
    });
    return useFileOrInject(normalizedMode, urlRes.res.url, urlRes.text, {
      prefix: params.prefix,
      lang: params[`mime_${urlRes.res.headers.get("content-type")?.split(";")[0]}_lang`] ?? params.lang,
    });
  }

  /// Handle FILE, INJECT, and FILE_TREE modes

  const isGlob = isDynamicPattern(glob_or_filepath);
  debug("isGlob", isGlob);
  const isInsideBaseDir = (targetPath: string) => normalizeFilePath(path.resolve(baseDir, targetPath)).startsWith(normalizeFilePath(baseDir) + "/");
  // canNotGlobby: 判断是否是一个绝对明确的外置文件路径，这种情况下进行 globbySync 的难度比较大，目前不支持
  const isOutBaseDirFile = !isGlob && !isInsideBaseDir(glob_or_filepath);

  debug("canNotGlobby", isOutBaseDirFile);

  let files = isOutBaseDirFile
    ? [glob_or_filepath]
    : globbySync(
        glob_or_filepath,
        (() => {
          let opts = {
            expandDirectories: match(params.expandDirectories)
              .with(P.boolean, (v) => v)
              .with(P.array(P.string), (v) => v)
              .with({files: P.array(P.string).optional(), extensions: P.array(P.string).optional()}, (v) => v)
              .otherwise(() => undefined),
            gitignore: match(params.gitignore)
              .with(P.boolean, (v) => v)
              .otherwise(() =>
                // 如果是一个glob，那么默认启用 gitignore。这样意味着如果直接提供一个明确的文件路径，那么默认不会走gitignore判定
                isGlob ? true : false,
              ),
            ignore: match(params.ignore)
              .with(P.string, (v) => [v])
              .with(P.array(P.string), (v) => v)
              .otherwise(() => undefined),
            ignoreFiles: match(params.ignoreFiles)
              .with(P.string, P.array(P.string), (v) => v)
              .otherwise(() => undefined),
            cwd: match(params.cwd)
              .with(P.string, (v) => v)
              .otherwise(() => baseDir),
            absolute: match(params.absolute)
              .with(P.boolean, (v) => v)
              .otherwise(() => undefined),
            baseNameMatch: match(params.baseNameMatch)
              .with(P.boolean, (v) => v)
              .otherwise(() => undefined),
            braceExpansion: match(params.braceExpansion)
              .with(P.boolean, (v) => v)
              .otherwise(() => undefined),
            caseSensitiveMatch: match(params.caseSensitiveMatch)
              .with(P.boolean, (v) => v)
              .otherwise(() => undefined),
            concurrency: match(params.concurrency)
              .with(P.number, (v) => v)
              .otherwise(() => undefined),
            deep: match(params.deep)
              .with(P.number, (v) => v)
              .otherwise(() => undefined),
            dot: match(params.dot)
              .with(P.boolean, (v) => v)
              .otherwise(() => undefined),
            extglob: match(params.extglob)
              .with(P.boolean, (v) => v)
              .otherwise(() => undefined),
            followSymbolicLinks: match(params.followSymbolicLinks)
              .with(P.boolean, (v) => v)
              .otherwise(() => undefined),
            globstar: match(params.globstar)
              .with(P.boolean, (v) => v)
              .otherwise(() => undefined),
            markDirectories: match(params.markDirectories)
              .with(P.boolean, (v) => v)
              .otherwise(() => undefined),
            objectMode: match(params.objectMode)
              .with(P.boolean, (v) => v)
              .otherwise(() => undefined),
            onlyDirectories: match(params.onlyDirectories)
              .with(P.boolean, (v) => v)
              .otherwise(() => undefined),
            onlyFiles: match(params.onlyFiles)
              .with(P.boolean, (v) => v)
              .otherwise(() => undefined),
            stats: match(params.stats)
              .with(P.boolean, (v) => v)
              .otherwise(() => undefined),
            suppressErrors: match(params.suppressErrors)
              .with(P.boolean, (v) => v)
              .otherwise(() => undefined),
            throwErrorOnBrokenSymbolicLink: match(params.throwErrorOnBrokenSymbolicLink)
              .with(P.boolean, (v) => v)
              .otherwise(() => undefined),
            unique: match(params.unique)
              .with(P.boolean, (v) => v)
              .otherwise(() => undefined),
          } satisfies GlobbyOptions;
          opts = JSON.parse(JSON.stringify(opts));
          debug("globbyOptions", opts);
          return opts;
        })(),
      );

  if (files.length === 0) {
    debug(`processReplacement (${normalizedMode} mode) returning original placeholder: ${_}`);
    return `<!-- No files found for pattern: ${glob_or_filepath} -->`;
  }
  const lines: string[] = [];

  if (normalizedMode === "FILE_TREE") {
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
      const ext = path.parse(filepath).ext.slice(1);

      lines.push(
        useFileOrInject(normalizedMode, filepath, fileContent, {
          prefix: params.prefix,
          lang: params[`map_ext_${ext}_lang`] ?? params.lang,
        }),
      );
    }
  } else if (normalizedMode === "INJECT") {
    for (const filepath of files) {
      const fullFilepath = rootResolver(filepath);
      if (!statSync(fullFilepath).isFile()) {
        continue;
      }
      const fileContent = getFileState(fullFilepath, once).get();
      lines.push(useFileOrInject(normalizedMode, filepath, fileContent));
    }
  } else {
    lines.push(`<!-- unknown mode ${normalizedMode} -->`);
  }

  const result = lines.join("\n");
  return result;
};

export const gen_prompt = async (input: string, once: boolean, _output?: string, cwd?: string) => {
  console.log(blue("gen_prompt"), input);

  /// 解析 input
  const inputSource = getFileState(input, once).get();
  let {data: inputData, content: inputContent} = matter(inputSource);
  inputContent = removeMarkdownComments(inputContent).trim();

  /// 解析 cwd
  // Create a root resolver based on the input file's directory
  const currentRootResolver = cwd
    ? createResolver(cwd)
    : match(inputData.cwd)
        .with(P.string, (v) => createResolver(v))
        .otherwise(() =>
          createResolverByRootFile(input, ".git", () => {
            const cwd = normalizeFilePath(process.cwd());
            if (input.startsWith(cwd + "/")) {
              return cwd;
            }
            return path.dirname(input);
          }),
        );

  /// 解析 output
  const output = currentRootResolver(
    _output ??
      match(inputData.output)
        .with(P.string, (v) => v)
        .otherwise(() => input.replace(/\.md$/, ".gen.md")),
  );

  const regex = /\[(.+?)\]\(@([\w-_:]+)(\?.+)?\)/g; // Updated regex to capture parameters
  const matches = [...inputContent.matchAll(regex)];

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

  mkdirSync(path.dirname(output), {recursive: true});
  writeFileSync(output, outputContent);
  console.log(blue(new Date().toLocaleTimeString()), green(`✅ ${path.parse(output).name} updated`));
};

const gen_prompts = (dirname: string, once: boolean, glob = "*.meta.md", cwd?: string) => {
  console.log(blue("gen_prompts"), dirname, glob);
  for (const filename of dirGlobState(dirname, glob, once).get()) {
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
