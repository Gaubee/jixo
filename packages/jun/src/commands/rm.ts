import fsp from "node:fs/promises";
import {getJunDir, getLogPath, readMeta, updateMeta} from "../state.js";

interface RmOptions {
  pids?: number[];
  all?: boolean;
  auto?: boolean;
}

export async function junRmLogic({pids = [], all = false, auto = false}: RmOptions): Promise<{removed: number[]; skipped: Array<{pid: number; reason: string}>}> {
  const junDir = await getJunDir();
  const tasks = await readMeta(junDir);
  let pidsToRemove: number[];
  const removed: number[] = [];
  const skipped: Array<{pid: number; reason: string}> = [];

  if (all) {
    pidsToRemove = [...tasks.keys()].filter((pid) => tasks.get(pid)?.status !== "running");
  } else if (auto) {
    const allTasks = [...tasks.values()].sort((a, b) => b.pid - a.pid);
    const runningPids = new Set(allTasks.filter((t) => t.status === "running").map((t) => t.pid));
    const recentPids = new Set(allTasks.slice(0, 10).map((t) => t.pid));
    pidsToRemove = allTasks.filter((t) => !runningPids.has(t.pid) && !recentPids.has(t.pid)).map((t) => t.pid);
  } else {
    pidsToRemove = pids;
  }

  if (pidsToRemove.length === 0) return {removed, skipped};

  await updateMeta(junDir, (tasksToUpdate) => {
    for (const pid of pidsToRemove) {
      if (tasksToUpdate.get(pid)?.status === "running") {
        skipped.push({pid, reason: "Task is currently running."});
        continue;
      }
      if (tasksToUpdate.delete(pid)) {
        removed.push(pid);
      } else {
        skipped.push({pid, reason: "Task not found."});
      }
    }
  });

  // Delete log files after meta has been updated
  for (const pid of removed) {
    try {
      await fsp.rm(getLogPath(junDir, pid));
    } catch (e: any) {
      if (e.code !== "ENOENT") throw e;
    }
  }

  return {removed, skipped};
}
