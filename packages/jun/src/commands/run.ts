import Debug from "debug";
import {createRequire} from "node:module";
import stripAnsi from "strip-ansi";
import {getJunDir, updateMeta} from "../state.js";
import type {JunTask, JunTaskOutput} from "../types.js";
import {spawnAndLog, updateTaskCompletion, type SpawnResult} from "./common.js";
const require = createRequire(import.meta.url);
const AnsiToHtmlConvert = require("ansi-to-html") as typeof import("ansi-to-html");

const debug = Debug("jun:run");

export interface JunRunOptions {
  command: string;
  commandArgs: string[];
  output?: JunTaskOutput;
  mode?: "tty" | "cp";
  timeout?: number;
  idleTimeout?: number;
  onStdout?: (data: string) => void;
  onStderr?: (data: string) => void;
  onOutput?: (data: string) => void;
}

export async function junRunLogic(options: JunRunOptions): Promise<SpawnResult> {
  const {command, commandArgs, output = "raw", mode = "cp", timeout, idleTimeout, onStdout, onStderr, onOutput} = options;
  const junDir = await getJunDir();

  let formatOutput = (data: Buffer | string) => data.toString();
  if (output === "text") {
    formatOutput = (data) => stripAnsi(data.toString());
  }
  if (output === "html") {
    const convert = new AnsiToHtmlConvert({stream: true});
    formatOutput = (data) => convert.toHtml(data.toString());
  }

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
    timeout,
    idleTimeout,
    onStdout: onOutput
      ? (output) => {
          const resOutput = formatOutput(output);
          onOutput(resOutput);
          return resOutput;
        }
      : undefined,
    onStderr: onOutput
      ? (output) => {
          const resOutput = formatOutput(output);
          onOutput(resOutput);
          return resOutput;
        }
      : undefined,
    onOutput: onOutput
      ? (output) => {
          const resOutput = formatOutput(output);
          onOutput(resOutput);
          return resOutput;
        }
      : undefined,
  });

  await updateMeta(junDir, (tasks) => {
    const task = tasks.get(newPid);
    if (task) task.osPid = osPid;
  });
  debug(`Foreground task ${newPid} registered with OS PID: ${osPid}`);

  const result = await resultPromise;
  await updateTaskCompletion(junDir, result);

  return result;
}


