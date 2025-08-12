process.removeAllListeners("warning");

import {createResolver} from "@gaubee/nodekit";
import {globbySync, isDynamicPattern} from "globby";
import fs from "node:fs";
import path from "node:path";
import {simpleGit} from "simple-git";
import {applyChanges, confirmAction} from "./apply-ai-response/actions.js";
import {logger} from "./apply-ai-response/logger.js";
import {parseMarkdown, type DiffFiles, type GitCommitMessage} from "./apply-ai-response/parser.js";

const fsp = fs.promises;

export interface ApplyOptions {
  /** Skip confirmation prompt and apply all changes. */
  yes?: boolean;
  /** Set the working directory. */
  cwd?: string;
  /** Allow unsafe file paths (e.g., outside of project root). */
  unsafe?: boolean;
  /** Format code after applying changes. */
  format?: boolean;
  /** Automatically commit changes with the message from markdown. */
  gitCommit?: boolean;
}

/**
 * Parses AI-generated markdown files, prompts for confirmation, and applies the specified file changes.
 *
 * @param markdownFilePaths - A single path, or an array of paths/glob patterns to the markdown files.
 * @param options - Configuration options for the operation.
 * @returns A promise that resolves to an array of the file diffs that were actually applied.
 */
export async function doApplyAiResponse(markdownFilePaths: string[] | string, {yes, cwd = process.cwd(), unsafe, format, gitCommit}: ApplyOptions = {}): Promise<DiffFiles> {
  if (typeof markdownFilePaths === "string") {
    markdownFilePaths = [markdownFilePaths];
  }
  if (markdownFilePaths.length === 0) {
    logger.error("Usage: jixo apply <path_to_markdown_file>...");
    process.exit(1);
  }

  // 1. Resolve all input paths and glob patterns
  const absolutePaths = [
    ...new Set(
      markdownFilePaths
        .flatMap((f) => {
          if (isDynamicPattern(f)) {
            return globbySync(f, {cwd, absolute: true});
          }
          let absolutePath = path.resolve(cwd, f);
          if (!fs.existsSync(absolutePath) && !absolutePath.endsWith(".md")) {
            const mdPath = absolutePath + ".md";
            if (fs.existsSync(mdPath)) {
              return mdPath;
            }
          }
          return absolutePath;
        })
        .filter(fs.existsSync),
    ),
  ];

  if (absolutePaths.length === 0) {
    logger.warn("No valid markdown files found from the provided paths.");
    return [];
  }

  const rootResolver = createResolver(cwd);

  try {
    // 2. Parse all markdown files to get a list of changes
    logger.info(`Reading changes from:\n\t- ${absolutePaths.map((p) => logger.file(path.relative(cwd, p))).join("\n\t- ")}`);

    let combinedGitCommit: GitCommitMessage | null = null;
    const allDiffFiles: DiffFiles = [];

    for (const filepath of absolutePaths) {
      const markdownContent = await fsp.readFile(filepath, "utf-8");
      const {gitCommitMessage, diffFiles} = parseMarkdown(filepath, markdownContent, rootResolver);
      combinedGitCommit ??= gitCommitMessage; // Use the first commit message found
      allDiffFiles.push(...diffFiles);
    }

    // 3. Confirm which changes to apply (unless --yes is specified)
    let filesToUpdate = allDiffFiles.filter((f) => f.safe || unsafe);
    if (!yes && filesToUpdate.length > 0) {
      filesToUpdate = await confirmAction(filesToUpdate, {
        topMessage: combinedGitCommit ? logger.commitMessage(combinedGitCommit.title, combinedGitCommit.detail) : undefined,
        allowUnsafe: unsafe,
      });
    }

    // 4. Apply the confirmed changes
    if (filesToUpdate.length > 0) {
      logger.info("Applying changes...");
      await applyChanges(filesToUpdate, format);
      logger.success("All selected changes have been applied successfully!");
    } else {
      logger.info("Operation cancelled or no changes to apply.");
      return [];
    }

    // 5. Optionally, commit the changes using Git
    if (gitCommit) {
      if (!combinedGitCommit) {
        logger.warn("No Git commit message found in markdown. Skipping commit.");
      } else {
        const git = simpleGit(cwd);
        const changedFiles = new Set(filesToUpdate.flatMap((f) => [f.fullSourcePath, f.fullTargetPath]));
        const ignoredFiles = new Set(await git.checkIgnore([...changedFiles]));
        const commitFiles = changedFiles.difference(ignoredFiles);
        await git.add([...commitFiles]);
        const commitRes = await git.commit(combinedGitCommit.all, [...commitFiles]);
        logger.success(`Changes committed successfully! ${logger.file(commitRes.commit)}`);
      }
    }

    return filesToUpdate;
  } catch (error) {
    logger.error(`An error occurred: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
