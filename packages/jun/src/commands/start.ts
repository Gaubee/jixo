import Debug from "debug";
import {execaNode, type ResultPromise} from "execa";
import {import_meta_ponyfill} from "import-meta-ponyfill";
import {fileURLToPath} from "node:url";
import {getJunDir, updateMeta} from "../state.js";
import type {JunTask, JunTaskOutput} from "../types.js";

const debug = Debug("jun:start");

export interface JunStartOptions {
  command: string;
  commandArgs: string[];
  json: boolean;
  output?: JunTaskOutput;
  mode?: "tty" | "cp";
  onBackgroundProcess?: (processPromise: ResultPromise) => void;
}

export async function junStartLogic(options: JunStartOptions): Promise<number> {
  const {command, commandArgs, json, output = "raw", mode = "tty", onBackgroundProcess} = options;
  const junDir = await getJunDir();

  // Get the new PID and create the initial task entry atomically.
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

  debug("Starting background task");
  const cliPath = fileURLToPath(await import_meta_ponyfill(import.meta).resolve("#cli"));
  // Pass the correct command ('run') to the background process
  const backgroundArgs = ["run", "--output", output, "--mode", mode, "--", command, ...commandArgs];
  const subprocess = execaNode(cliPath, backgroundArgs, {
    detached: true,
    stdio: "ignore",
  });
  subprocess.unref();
  onBackgroundProcess?.(subprocess);

  debug(`Background process spawned with OS PID: ${subprocess.pid}`);
  await updateMeta(junDir, (tasks) => {
    const task = tasks.get(newPid);
    if (task) task.osPid = subprocess.pid;
  });

  if (json) {
    console.log(JSON.stringify({status: "STARTED_IN_BACKGROUND", pid: newPid, osPid: subprocess.pid}));
  } else {
    console.log(`[jun] Started background task ${newPid} (OS PID: ${subprocess.pid}): ${command} ${commandArgs.join(" ")}`);
  }
  return 0;
}
