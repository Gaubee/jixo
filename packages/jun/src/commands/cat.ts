import {getJunDir, readLog, readMeta} from "../state.js";
import type {JunTaskLog, StdioLogEntry} from "../types.js";

export async function junCatLogic(pids: number[]): Promise<{success: Array<JunTaskLog & {stdio: StdioLogEntry[]}>; failed: Array<{pid: number; reason: string}>}> {
  const success: JunTaskLog[] = [];
  const failed: Array<{pid: number; reason: string}> = [];
  if (pids.length === 0) return {success, failed};
  const junDir = await getJunDir();
  const tasks = await readMeta(junDir);
  for (const pid of pids) {
    const task = tasks.get(pid);
    if (!task) {
      failed.push({pid, reason: "Task not found."});
      continue;
    }
    try {
      const stdio = await readLog(junDir, pid);
      success.push({...task, stdio});
    } catch {
      failed.push({pid, reason: "Failed to read log."});
    }
  }
  return {success, failed};
}
