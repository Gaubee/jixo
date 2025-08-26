import {ensureDir, ensureFile} from "@std/fs";
import {resolve} from "@std/path";
import type {JunTask, StdioLogEntry} from "./types.ts";

export const getJunDir = async (): Promise<string> => {
  const localDir = resolve(Deno.cwd(), ".jun");
  try {
    const fileInfo = await Deno.stat(localDir);
    if (!fileInfo.isDirectory) {
      throw new Error(`Found local .jun, but it is not a directory.`);
    }
    return localDir;
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) {
      const home = Deno.env.get("HOME") || Deno.env.get("USERPROFILE");
      if (!home) throw new Error("Could not determine home directory.");
      const globalDir = resolve(home, ".jun");
      await ensureDir(globalDir);
      return globalDir;
    }
    throw e;
  }
};

export const getMetaPath = (junDir: string): string => resolve(junDir, "meta.jsonl");

export async function readMeta(junDir: string): Promise<Map<number, JunTask>> {
  const metaPath = getMetaPath(junDir);
  await ensureFile(metaPath);
  const content = await Deno.readTextFile(metaPath);
  const tasks = new Map<number, JunTask>();
  if (content.trim() === "") return tasks;
  for (const line of content.trim().split("\n")) {
    try {
      const task = JSON.parse(line) as JunTask;
      tasks.set(task.pid, task);
    } catch {
      /* ignore malformed lines */
    }
  }
  return tasks;
}

export async function overwriteMeta(junDir: string, tasks: Map<number, JunTask>): Promise<void> {
  const metaPath = getMetaPath(junDir);
  const lines = [...tasks.values()].map((task) => JSON.stringify(task));
  await Deno.writeTextFile(metaPath, lines.join("\n") + (lines.length > 0 ? "\n" : ""));
}

export const getLogPath = (junDir: string, pid: number): string => resolve(junDir, "logs", `${pid}.jsonl`);

export async function readLog(junDir: string, pid: number): Promise<StdioLogEntry[]> {
  const logPath = getLogPath(junDir, pid);
  try {
    const content = await Deno.readTextFile(logPath);
    return content
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) return [];
    throw e;
  }
}

export async function writeLog(junDir: string, pid: number, logEntry: StdioLogEntry): Promise<void> {
  const logPath = getLogPath(junDir, pid);
  await ensureDir(resolve(junDir, "logs"));
  const line = JSON.stringify(logEntry) + "\n";
  await Deno.writeTextFile(logPath, line, {append: true});
}

// JIXO_CODER_EOF
