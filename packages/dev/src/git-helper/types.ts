import {match} from "ts-pattern";

/**
 * 文件变更状态的类型。
 * A: Added, M: Modified, D: Deleted, R: Renamed, U: Unmerged (冲突)
 */
export type GitFileStatus = "A" | "M" | "D" | "R" | "U" | "T";

export const humanfiyedGitFileStatus = (status: GitFileStatus) => {
  return match(status)
    .with("A", () => "Added")
    .with("M", () => "Modified")
    .with("D", () => "Deleted")
    .with("R", () => "Renamed")
    .with("U", () => "Unmerged")
    .with("T", () => "Type Changed")
    .otherwise((v) => v);
};

/**
 * 定义返回结果中每个文件对象的结构。
 */
export interface GitFileContentResult {
  /** 文件的仓库相对路径 */
  path: string;
  /** 文件内容的字符串形式。如果文件未找到或发生错误，则为 null。 */
  content: string | undefined;
  /** 文件状态 */
  status: GitFileStatus;
}


/**
 * 定义单个文件 diff 的结构。
 */
export interface GitFileDiffResult {
  /** 文件的仓库相对路径 */
  path: string;
  /** 文件变更状态 */
  status: GitFileStatus;
  /** 完整的 diff 内容 */
  diff: string;
}


export interface GetGitFilesOptions {
  filePaths?: string[];
  staged?: boolean;
}
