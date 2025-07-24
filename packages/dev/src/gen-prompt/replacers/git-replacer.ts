import micromatch from "micromatch";
import {cpus} from "node:os";
import path from "node:path";
import {simpleGit} from "simple-git";
import {match, P} from "ts-pattern";
import {getCommitDiffs} from "../../git-helper/getCommitDiffs.js";
import {getMultipleFileContents} from "../../git-helper/getMultipleFileContents.js";
import {getWorkingCopyContents} from "../../git-helper/getWorkingCopyContents.js";
import {getWorkingCopyDiffs} from "../../git-helper/getWorkingCopyDiffs.js";
import type {Replacer} from "./types.js";

function useFileOrInject(mode: string, filepath: string, filecontent: string, opts: {lang?: unknown; prefix?: unknown} = {}): string {
  const lines: Array<string[] | string> = [];
  const prefixStr = match(opts.prefix)
    .with(P.number, (len) => " ".repeat(len))
    .with(P.string, (str) => str)
    .otherwise(() => "");

  const contentLines = prefixStr.length ? filecontent.split("\n").map((line) => prefixStr + line) : [filecontent];

  if (mode === "FILE") {
    const split = filecontent.includes("```") ? "````" : "```";
    const ext = path.parse(filepath).ext.slice(1);
    lines.push(
      `${prefixStr}\`${filepath}\``,
      "",
      prefixStr +
        split +
        match(opts.lang)
          .with(P.string, (v) => v)
          .otherwise(() => ext),
      ...contentLines,
      prefixStr + split,
      "",
    );
  } else if (mode === "INJECT") {
    lines.push(...contentLines);
  } else {
    lines.push(`<!-- unknown mode ${mode} -->`);
  }
  return lines.join("\n");
}

export const handleGitReplacement: Replacer = async ({globOrFilepath, params, baseDir}) => {
  const normalizedMode = (params.mode as string).toUpperCase().replaceAll("-", "_").trim();
  const git = simpleGit({baseDir, maxConcurrentProcesses: cpus().length});

  let commitHash: string | undefined;
  let filePattern: string;
  const parts = globOrFilepath.split(":");
  if (parts.length > 1) {
    commitHash = parts.at(0)!;
    filePattern = parts.slice(1).join(":");
  } else {
    filePattern = globOrFilepath;
  }
  filePattern = filePattern.trim();

  try {
    let filesToProcess: string[] = [];
    if (commitHash) {
      filesToProcess = (await git.show([commitHash, "--pretty=", "--name-only", "--", filePattern])).split("\n").filter(Boolean);
    } else {
      const statusResult = await git.status();
      const uncommittedFiles = statusResult.files.filter((f) => f.index !== " " || f.working_dir !== " ").map((f) => f.path);
      filesToProcess = micromatch.match(uncommittedFiles, filePattern);
    }

    if (filesToProcess.length === 0) {
      return `<!-- No files found for pattern: ${filePattern} ${commitHash ? `at commit ${commitHash}` : "in working directory"} -->`;
    }

    const lines: string[] = [];

    if (normalizedMode === "GIT_FILE") {
      const result = commitHash
        ? await getMultipleFileContents(baseDir, commitHash, filesToProcess)
        : await getWorkingCopyContents(baseDir, filesToProcess, {staged: typeof params.staged === "boolean" ? params.staged : undefined});

      for (const item of result) {
        const ext = path.parse(item.path).ext.slice(1);
        if (item.error?.startsWith("File not found")) continue;
        lines.push(
          useFileOrInject("FILE", item.path, item.content ?? `<!-- ERROR: ${item.error ?? "No error message provided"} -->`, {
            prefix: params.prefix,
            lang: params[`map_ext_${ext}_lang`] ?? params.lang,
          }),
        );
      }
    } else if (normalizedMode === "GIT_DIFF") {
      if (commitHash) {
        const result = await getCommitDiffs(baseDir, commitHash, filesToProcess);
        for (const item of result.files) {
          lines.push(useFileOrInject("FILE", `${item.path} (${item.status})`, item.diff, {prefix: params.prefix, lang: "diff"}));
        }
      } else {
        const result = await getWorkingCopyDiffs(baseDir, {
          staged: typeof params.staged === "boolean" ? params.staged : undefined,
          filePaths: filesToProcess,
        });
        for (const item of result) {
          lines.push(useFileOrInject("FILE", `${item.path} (${item.status})`, item.diff, {prefix: params.prefix, lang: "diff"}));
        }
      }
    }
    return lines.join("\n");
  } catch (error: unknown) {
    console.error(`Error processing GIT mode for ${globOrFilepath}:`, error);
    return `<!-- Error processing GIT mode for ${globOrFilepath}: ${(error as Error).message} -->`;
  }
};
