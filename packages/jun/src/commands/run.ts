import {getJunDir, overwriteMeta, readMeta, writeLog} from "../state.ts";
import type {JunTask} from "../types.ts";

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function junRunLogic(command: string, commandArgs: string[]): Promise<number> {
  const junDir = await getJunDir();
  let tasks = await readMeta(junDir);
  const newPid = (tasks.size > 0 ? Math.max(...tasks.keys()) : 0) + 1;

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
  console.log(`[jun] Started task ${newPid} (OS PID: ${process.pid}): ${command} ${commandArgs.join(" ")}`);

  const log = (type: "stdout" | "stderr" | "stdin", content: string) => writeLog(junDir, newPid, {type, content, time: new Date().toISOString()});

  const handleStream = async (stream: ReadableStream<Uint8Array>, type: "stdout" | "stderr") => {
    for await (const chunk of stream) {
      Deno[type].write(chunk);
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
    console.log(`[jun] Task ${newPid} finished with status: ${finalStatus}`);
  }

  // Pragmatic delay to ensure filesystem buffers are flushed before the process exits,
  // which helps prevent race conditions in fast-running E2E tests.
  await delay(10);

  return status.code;
}

// JIXO_CODER_EOF
