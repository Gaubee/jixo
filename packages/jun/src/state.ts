import fsp from "node:fs/promises";
import path from "node:path";
import lockfile from "proper-lockfile";
import type {JunTask, StdioLogEntry} from "./types.ts";

async function ensureDir(dirPath: string) {
  try {
    await fsp.mkdir(dirPath, {recursive: true});
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code !== "EEXIST") {
      throw error;
    }
  }
}

async function ensureFile(filePath: string) {
  try {
    await fsp.access(filePath);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      await ensureDir(path.dirname(filePath));
      await fsp.writeFile(filePath, "", "utf-8");
    } else {
      throw error;
    }
  }
}

/**
 * 确保目录存在，若不存在则创建（包括父目录）
 * @param dirPath - 要确保存在的目录路径
 * @throws 若创建失败或路径无效则抛出错误
 */
const ensureDirectoryExists = async (dirPath: string): Promise<void> => {
  try {
    await fsp.mkdir(dirPath, {recursive: true});
  } catch (error) {
    throw new Error(`Failed to create directory: ${dirPath}. Reason: ${error instanceof Error ? error.message : String(error)}`);
  }
};

/**
 * 向上遍历目录树，寻找最近的 .git 目录
 * @param startDir - 起始目录路径
 * @returns 找到的 .git 目录路径，或 null（未找到）
 */
const findNearestGitDir = async (startDir: string): Promise<string | null> => {
  let currentDir = path.resolve(startDir);
  const rootPath = path.parse(currentDir).root; // 获取根路径（如 "/" 或 "C:\\"）

  while (currentDir !== rootPath) {
    const gitDir = path.join(currentDir, ".git");
    try {
      const stats = await fsp.stat(gitDir);
      if (stats.isDirectory()) {
        return gitDir;
      }
    } catch (error: unknown) {
      // ENOENT 表示文件/目录不存在，继续向上查找
      if (!(error instanceof Error) || (error as NodeJS.ErrnoException).code !== "ENOENT") {
        // 非“不存在”错误，向上抛出
        throw new Error(`Error checking for .git at ${gitDir}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    // 向上移动一级目录
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) break; // 防止无限循环（已到根）
    currentDir = parentDir;
  }

  // 检查根目录本身
  const rootGitDir = path.join(rootPath, ".git");
  try {
    const stats = await fsp.stat(rootGitDir);
    if (stats.isDirectory()) {
      return rootGitDir;
    }
  } catch {
    // 根目录无 .git，返回 null
  }

  return null;
};

/**
 * 获取 Jun 配置目录路径
 * 优先级：
 * 1. 当前工作目录下的 `.jun` 目录（cwd/.jun）
 * 2. 若不存在，则查找最近的 `.git` 目录，并在其内创建 `.jun` 子目录（如 cwd/../.git/.jun）
 * 3. 若未找到 `.git`，则在用户主目录下创建并返回 `~/.jun`
 *
 * @returns Promise<string> - Jun 目录的绝对路径
 * @throws 若无法创建目录或获取主目录则抛出错误
 */
export const getJunDir = async (): Promise<string> => {
  const cwd = process.cwd();
  const localJunDir = path.resolve(cwd, ".jun");

  try {
    // 优先检查当前目录是否存在 .jun 目录
    const stats = await fsp.stat(localJunDir);
    if (!stats.isDirectory()) {
      throw new Error(`Found "${localJunDir}", but it is not a directory.`);
    }
    return localJunDir;
  } catch (error: unknown) {
    // 若 .jun 不存在或不是目录，则继续查找 .git
    if (!(error instanceof Error) || (error as NodeJS.ErrnoException).code !== "ENOENT") {
      // 非“不存在”错误，直接抛出
      throw error;
    }

    // 查找最近的 .git 目录
    const gitDir = await findNearestGitDir(cwd);
    if (gitDir) {
      // 在 .git 内创建 .jun 子目录
      const junDirInGit = path.join(gitDir, ".jun");
      await ensureDirectoryExists(junDirInGit);
      return junDirInGit;
    }

    // 未找到 .git，回退到用户主目录
    const homeDir = process.env.HOME || process.env.USERPROFILE;
    if (!homeDir) {
      throw new Error("Could not determine home directory. Ensure HOME or USERPROFILE environment variable is set.");
    }

    const globalJunDir = path.resolve(homeDir, ".jun");
    await ensureDirectoryExists(globalJunDir);
    return globalJunDir;
  }
};

export const getMetaPath = (junDir: string): string => path.resolve(junDir, "meta.jsonl");
const getLockPath = (junDir: string): string => path.resolve(junDir, ".meta.lock");

/**
 * Executes a callback with an exclusive lock.
 * @param junDir The jun directory.
 * @param callback The function to execute while holding the lock.
 */
async function withMetaLock<T>(junDir: string, callback: () => Promise<T>): Promise<T> {
  const lockPath = getLockPath(junDir);
  await ensureFile(lockPath); // Ensure the lock file itself exists
  let release: (() => Promise<void>) | undefined;
  try {
    release = await lockfile.lock(lockPath, {retries: {retries: 5, factor: 1.2, minTimeout: 100}});
    // Now that we have the lock, we can safely ensure the data file exists
    await ensureFile(getMetaPath(junDir));
    return await callback();
  } finally {
    if (release) {
      await release();
    }
  }
}

async function _readMetaUnsafe(junDir: string): Promise<Map<number, JunTask>> {
  const metaPath = getMetaPath(junDir);
  const content = await fsp.readFile(metaPath, "utf-8");
  const tasks = new Map<number, JunTask>();
  if (content.trim() === "") return tasks;
  for (const line of content.trim().split("\n")) {
    try {
      const task = JSON.parse(line) as JunTask;
      tasks.set(task.pid, task);
    } catch (e) {
      console.error(`[jun] Error parsing task metadata: ${e}`);
      /* ignore malformed lines */
    }
  }
  return tasks;
}

async function _overwriteMetaUnsafe(junDir: string, tasks: Map<number, JunTask>): Promise<void> {
  const metaPath = getMetaPath(junDir);
  const lines = [...tasks.values()].map((task) => JSON.stringify(task));
  await fsp.writeFile(metaPath, lines.join("\n") + (lines.length > 0 ? "\n" : ""));
}

export async function readMeta(junDir: string): Promise<Map<number, JunTask>> {
  const job = Promise.withResolvers<Map<number, JunTask>>();
  void withMetaLock(junDir, async () => {
    job.resolve(await _readMetaUnsafe(junDir));
  });
  return job.promise;
}

/**
 * Atomically updates the meta file by acquiring a lock, reading the content,
 * yielding it to a callback for modification, and writing the result back.
 * @param junDir The jun directory.
 * @param updater A callback that receives the current tasks map and can modify it.
 */
export async function updateMeta(junDir: string, updater: (tasks: Map<number, JunTask>) => void | Promise<void>): Promise<void> {
  await withMetaLock(junDir, async () => {
    const tasks = await _readMetaUnsafe(junDir);
    await updater(tasks);
    await _overwriteMetaUnsafe(junDir, tasks);
  });
}

export const getLogPath = (junDir: string, pid: number): string => path.resolve(junDir, "logs", `${pid}.jsonl`);

export async function readLog(junDir: string, pid: number): Promise<StdioLogEntry[]> {
  const logPath = getLogPath(junDir, pid);
  try {
    const content = await fsp.readFile(logPath, "utf-8");
    return content
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  } catch (e: any) {
    if (e.code === "ENOENT") return [];
    throw e;
  }
}

export async function writeLog(junDir: string, pid: number, logEntry: StdioLogEntry): Promise<void> {
  const logPath = getLogPath(junDir, pid);
  await ensureDir(path.resolve(junDir, "logs"));
  const line = JSON.stringify(logEntry) + "\n";
  await fsp.writeFile(logPath, line, {flag: "a"});
}
