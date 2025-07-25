import micromatch from "micromatch";
import {cpus} from "node:os";
import path from "node:path";
import {simpleGit} from "simple-git";
import {match, P} from "ts-pattern";
import {gitCommitContents} from "../../git-helper/gitCommitContents.js";
import {gitCommitDiffs} from "../../git-helper/gitCommitDiffs.js";
import {gitWorkingContents} from "../../git-helper/gitWorkingContents.js";
import {gitWorkingDiffs} from "../../git-helper/gitWorkingDiffs.js";
import {humanfiyedGitFileStatus} from "../../git-helper/types.js";
import type {Replacer} from "./types.js";

function useFileOrInject(mode: string, filepath: string, filecontent: string | undefined, opts: {lang?: unknown; prefix?: unknown} = {}): string {
  const lines: Array<string[] | string> = [];
  const prefixStr = match(opts.prefix)
    .with(P.number, (len) => " ".repeat(len))
    .with(P.string, (str) => str)
    .otherwise(() => "");

  const contentLines = (filecontent: string) => (prefixStr.length ? filecontent.split("\n").map((line) => prefixStr + line) : [filecontent]);

  if (mode === "FILE") {
    const split = filecontent?.includes("```") ? "````" : "```";
    const ext = path.parse(filepath).ext.slice(1);
    lines.push(`${prefixStr}\`${filepath}\``, "");
    if (filecontent) {
      lines.push(
        prefixStr +
          split +
          match(opts.lang)
            .with(P.string, (v) => v)
            .otherwise(() => ext),
        ...contentLines(filecontent),
        prefixStr + split,
        "",
      );
    }
  } else if (mode === "INJECT") {
    if (filecontent) {
      lines.push(...contentLines(filecontent));
    }
  } else {
    lines.push(`<!-- unknown mode ${mode} -->`);
  }
  return lines.join("\n");
}

export const handleGitReplacement: Replacer = async ({globOrFilepath, mode, params, baseDir}) => {
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

    if (mode === "GIT_FILE") {
      const result = commitHash
        ? await gitCommitContents(baseDir, commitHash, filesToProcess)
        : await gitWorkingContents(baseDir, {
            filePaths: filesToProcess,
            staged: typeof params.staged === "boolean" ? params.staged : undefined,
          });

      for (const item of result) {
        const ext = path.parse(item.path).ext.slice(1);
        lines.push(
          useFileOrInject("FILE", `${item.path} (${humanfiyedGitFileStatus(item.status)})`, item.content, {
            prefix: params.prefix,
            lang: params[`map_ext_${ext}_lang`] ?? params.lang,
          }),
        );
      }
    } else if (mode === "GIT_DIFF") {
      const result = commitHash
        ? await gitCommitDiffs(baseDir, commitHash, filesToProcess)
        : await gitWorkingDiffs(baseDir, {
            staged: typeof params.staged === "boolean" ? params.staged : undefined,
            filePaths: filesToProcess,
          });
      for (const item of result) {
        lines.push(useFileOrInject("FILE", `${item.path} (${humanfiyedGitFileStatus(item.status)})`, item.diff, {prefix: params.prefix, lang: "diff"}));
      }
    }
    return lines.join("\n");
  } catch (error: unknown) {
    console.error(`Error processing GIT mode for ${globOrFilepath}:`, error);
    return `<!-- Error processing GIT mode for ${globOrFilepath}: ${(error as Error).message} -->`;
  }
};
