import type {GitFileStatus} from "./types.js";

// 辅助函数：解析 `git diff --name-status` 的输出
export const parseNameStatus = (output: string): GitFilepathWithStatus[] => {
  if (!output.trim()) {
    return [];
  }

  return output
    .trim()
    .split("\n")
    .map((line) => {
      const parts = line.split("\t");
      const statusChar = parts[0][0].toUpperCase() as GitFileStatus;
      // 重命名(R)和复制(C)的状态格式为: R100  old_path  new_path
      // 我们只关心新路径和'R'或'C'状态
      const filePath = parts.length > 2 ? parts[2] : parts[1];
      return [filePath, statusChar] satisfies [string, GitFileStatus];
    });
};

export type GitFilepathWithStatus = [string, GitFileStatus];
