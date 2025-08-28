import {getJunDir, overwriteMeta, readMeta, writeLog} from "../state.ts";
import type {JunTask} from "../types.ts";

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface JunRunOptions {
  command: string;
  commandArgs: string[];
  background: boolean;
  json: boolean;
}

export async function junRunLogic({command, commandArgs, background, json}: JunRunOptions): Promise<number> {
  const junDir = await getJunDir();
  let tasks = await readMeta(junDir);
  const newPid = (tasks.size > 0 ? Math.max(...tasks.keys()) : 0) + 1;

  if (background) {
    // For background tasks, we spawn jun itself as a detached process.
    const backgroundRunner = new Deno.Command(Deno.execPath(), {
      args: ["run", "-A", Deno.mainModule, "run", ...[command, ...commandArgs]],
      // Key for daemonization: these streams are ignored, not piped.
      stdin: "null",
      stdout: "null",
      stderr: "null",
    }).spawn();
    // Detach the child process from the parent.
    backgroundRunner.unref();

    // We must manually create the initial task entry here.
    const task: JunTask = {pid: newPid, osPid: backgroundRunner.pid, command, args: commandArgs, startTime: new Date().toISOString(), status: "running"};
    tasks.set(newPid, task);
    await overwriteMeta(junDir, tasks);

    if (json) {
      console.log(JSON.stringify({status: "STARTED_IN_BACKGROUND", pid: newPid, osPid: backgroundRunner.pid}));
    } else {
      console.log(`[jun] Started background task ${newPid} (OS PID: ${backgroundRunner.pid}): ${command} ${commandArgs.join(" ")}`);
    }
    return 0; // The parent (this process) exits successfully.
  }

  // --- Foreground task logic ---
  const process = new Deno.Command(command, {
    args: commandArgs,
    stdout: "piped",
    stderr: "piped",
    stdin: "piped",
  }).spawn();

  process.stdin.close();

  const task: JunTask = {pid: newPid, osPid: process.pid, command, args: commandArgs, startTime: new Date().toISOString(), status: "running"};
  tasks.set(newPid, task);
  await overwriteMeta(junDir, tasks);

  if (json) {
    console.log(JSON.stringify({status: "STARTED_IN_FOREGROUND", pid: newPid, osPid: process.pid}));
  } else {
    console.log(`[jun] Started task ${newPid} (OS PID: ${process.pid}): ${command} ${commandArgs.join(" ")}`);
  }

  const log = (type: "stdout" | "stderr" | "stdin", content: string) => writeLog(junDir, newPid, {type, content, time: new Date().toISOString()});

  const handleStream = async (stream: ReadableStream<Uint8Array>, type: "stdout" | "stderr") => {
    for await (const chunk of stream) {
      if (!json) Deno[type].write(chunk); // Only proxy output if not in json mode
      log(type, new TextDecoder().decode(chunk));
    }
  };

  const [status] = await Promise.all([process.status, handleStream(process.stdout, "stdout"), handleStream(process.stderr, "stderr")]);

  const endTime = new Date().toISOString();

  tasks = await readMeta(junDir);
  const currentTaskState = tasks.get(newPid);
  if (currentTaskState && currentTaskState.status === "running") {
    const finalStatus: JunTask["status"] = status.success ? "completed" : "error";
    const finalTask = {...currentTaskState, osPid: undefined, endTime, status: finalStatus};
    tasks.set(newPid, finalTask);
    await overwriteMeta(junDir, tasks);
    if (!json) console.log(`[jun] Task ${newPid} finished with status: ${finalStatus}`);
  }

  await delay(10);
  return status.code;
}
