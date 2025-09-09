import Debug from "debug";
import {getJunDir, updateMeta} from "../state.js";
import type {JunTask, JunTaskOutput} from "../types.js";
import {spawnAndLog, updateTaskCompletion} from "./common.js";

const debug = Debug("jun:start");

export interface JunStartOptions {
  command: string;
  commandArgs: string[];
  output?: JunTaskOutput;
  mode?: "tty" | "cp";
}

export async function junStartLogic(options: JunStartOptions): Promise<{pid: number}> {
  const {command, commandArgs, output = "raw", mode = "tty"} = options;
  const junDir = await getJunDir();

  let newPid = 0;
  await updateMeta(junDir, (tasks) => {
    newPid = (tasks.size > 0 ? Math.max(...tasks.keys()) : 0) + 1;
    const task: JunTask = {
      pid: newPid,
      command,
      args: commandArgs,
      startTime: new Date().toISOString(),
      status: "running",
      output,
      mode,
    };
    tasks.set(newPid, task);
  });

  const {osPid, resultPromise} = spawnAndLog({
    pid: newPid,
    junDir,
    command,
    args: commandArgs,
    mode,
  });

  // Chain the completion logic to the promise, but don't wait for it.
  // This allows the main process to exit while the logging continues.
  resultPromise.then((result) => updateTaskCompletion(junDir, result));

  await updateMeta(junDir, (tasks) => {
    const task = tasks.get(newPid);
    if (task) task.osPid = osPid;
  });
  debug(`Background task ${newPid} registered with OS PID: ${osPid}`);

  return {pid: newPid};
}


