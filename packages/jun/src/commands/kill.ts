import {getJunDir, overwriteMeta, readMeta} from "../state.ts";

interface KillOptions {
  pids?: number[];
  all?: boolean;
}
export async function junKillLogic({pids = [], all = false}: KillOptions): Promise<{killedCount: number; failedPids: Record<number, string>}> {
  const junDir = await getJunDir();
  const tasks = await readMeta(junDir);
  const runningTasks = [...tasks.values()].filter((t) => t.status === "running");
  let pidsToKill: number[];
  const failedPids: Record<number, string> = {};

  if (all) {
    pidsToKill = runningTasks.map((t) => t.pid);
  } else {
    pidsToKill = pids;
  }

  if (pidsToKill.length === 0) return {killedCount: 0, failedPids: {}};

  let killedCount = 0;
  for (const pid of pidsToKill) {
    const task = tasks.get(pid);
    if (!task || task.status !== "running" || typeof task.osPid !== "number") {
      failedPids[pid] = "Task is not running or has no OS PID.";
      continue;
    }
    try {
      Deno.kill(task.osPid, "SIGTERM");
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      failedPids[pid] = `Could not send kill signal: ${message}`;
    }
    task.status = "killed";
    task.endTime = new Date().toISOString();
    task.osPid = undefined;
    tasks.set(pid, task);
    killedCount++;
  }
  await overwriteMeta(junDir, tasks);
  return {killedCount, failedPids};
}

// JIXO_CODER_EOF
