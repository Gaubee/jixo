import {getJunDir, readLog, readMeta} from "../state.js";
import type {JunTaskLog} from "../types.js";

export async function junCatLogic(pids: number[]): Promise<{success: Record<number, JunTaskLog>; failed: Record<number, string>}> {
  if (pids.length === 0) return {success: {}, failed: {}};
  const junDir = await getJunDir();
  const tasks = await readMeta(junDir);
  const success: Record<number, JunTaskLog> = {};
  const failed: Record<number, string> = {};

  for (const pid of pids) {
    const task = tasks.get(pid);
    if (!task) {
      failed[pid] = "Task not found.";
      continue;
    }
    const stdio = await readLog(junDir, pid);
    success[pid] = {...task, stdio};
  }
  return {success, failed};
}
