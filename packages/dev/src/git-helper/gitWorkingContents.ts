import {func_parallel_limit} from "@gaubee/util";
import fs from "node:fs/promises";
import path from "node:path";
import {getWorkingFiles} from "./getWorkingFiles.js";
import type {GetGitFilesOptions, GitFileContentResult, GitFileStatus} from "./types.js";

/**
 * 内部辅助函数：使用 `git cat-file --batch` 从暂存区读取多个文件。
 * 注意：这里的实现与之前的 `getMultipleFileContents` 非常相似，但查询的是暂存区对象。
 */
export async function gitWorkingContents(repoPath: string, options: GetGitFilesOptions): Promise<GitFileContentResult[]> {
  const {trackedChanges, untrackedFiles} = await getWorkingFiles(repoPath, options);
  const results = new Map<string, GitFileContentResult>();

  await func_parallel_limit(
    [...trackedChanges.entries(), ...untrackedFiles.map((filepath) => [filepath, "A"] as [string, GitFileStatus])].map(([filepath, status]) => {
      return async () => {
        results.set(filepath, {
          path: filepath,
          content: status === "D" ? undefined : await fs.readFile(path.join(repoPath, filepath), "utf-8"),
          status,
        });

        console.log("QAQ results.size", results.size);
      };
    }),
    10,
  );
  return [...results.values()];
}
