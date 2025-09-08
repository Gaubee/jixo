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

export const getJunDir = async (): Promise<string> => {
  const localDir = path.resolve(process.cwd(), ".jun");
  try {
    const stats = await fsp.stat(localDir);
    if (!stats.isDirectory()) {
      throw new Error(`Found local .jun, but it is not a directory.`);
    }
    return localDir;
  } catch (e: any) {
    if (e.code === "ENOENT") {
      const home = process.env.HOME || process.env.USERPROFILE;
      if (!home) throw new Error("Could not determine home directory.");
      const globalDir = path.resolve(home, ".jun");
      await ensureDir(globalDir);
      return globalDir;
    }
    throw e;
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
    } catch (e){
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
