import {getJunDir, getLogPath, overwriteMeta, readMeta} from "../state.ts";

interface RmOptions {
  pids?: number[];
  all?: boolean;
  auto?: boolean;
}

export async function junRmLogic({pids = [], all = false, auto = false}: RmOptions): Promise<{removed: number[]; skipped: Record<number, string>}> {
  const junDir = await getJunDir();
  const tasks = await readMeta(junDir);
  let pidsToRemove: number[];
  const skipped: Record<number, string> = {};

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

  if (pidsToRemove.length === 0) return {removed: [], skipped: {}};

  const removed: number[] = [];
  for (const pid of pidsToRemove) {
    if (tasks.get(pid)?.status === "running") {
      skipped[pid] = "Task is currently running.";
      continue;
    }
    if (tasks.delete(pid)) {
      removed.push(pid);
      try {
        await Deno.remove(getLogPath(junDir, pid));
      } catch (e) {
        if (!(e instanceof Deno.errors.NotFound)) throw e;
      }
    } else {
      skipped[pid] = "Task not found.";
    }
  }
  await overwriteMeta(junDir, tasks);
  return {removed, skipped};
}

// JIXO_CODER_EOF
