import pty from "@lydell/node-pty";
import Debug from "debug";
import {execa} from "execa";
import {createRequire} from "node:module";
import stripAnsi from "strip-ansi";
import {getJunDir, readMeta, updateMeta, writeLog} from "../state.js";
import type {JunTask, JunTaskOutput, StdioLogEntry} from "../types.js";
const require = createRequire(import.meta.url);
const AnsiToHtmlConvert = require("ansi-to-html") as typeof import("ansi-to-html");

const debug = Debug("jun:run");

export interface JunRunOptions {
  command: string;
  commandArgs: string[];
  json: boolean;
  output?: JunTaskOutput;
  mode?: "tty" | "cp";
}

/**
 * Executes a command in TTY mode using node-pty.
 * This mode provides a pseudo-terminal, mixing stdout and stderr.
 */
async function runTty(pid: number, {command, commandArgs, json}: JunRunOptions, onData: (data: string) => void): Promise<number> {
  const junDir = await getJunDir();
  debug(`Spawning pty with command: ${command} ${commandArgs.join(" ")}`);

  const ptyProcess = pty.spawn(command, commandArgs, {
    name: "xterm-color",
    cols: process.stdout.columns || 80,
    rows: process.stdout.rows || 30,
    cwd: process.cwd(),
    env: process.env as {[key: string]: string},
  });

  const log = (content: string) => writeLog(junDir, pid, {type: "output", content, time: new Date().toISOString()});

  ptyProcess.onData((data) => {
    log(data);
    if (!json) {
      onData(data);
    }
  });

  const exitCodeJob = Promise.withResolvers<number>();
  ptyProcess.onExit(({exitCode}) => {
    debug(`PTY process ${ptyProcess.pid} exited with code ${exitCode}`);
    exitCodeJob.resolve(exitCode);
  });

  await updateMeta(junDir, (tasks) => {
    const task = tasks.get(pid);
    if (task) task.osPid = ptyProcess.pid;
  });
  debug(`Foreground task ${pid} registered with OS PID: ${ptyProcess.pid}`);

  if (json) {
    console.log(JSON.stringify({status: "STARTED_IN_FOREGROUND", pid, osPid: ptyProcess.pid}));
  } else {
    console.log(`[jun] Started task ${pid} (OS PID: ${ptyProcess.pid}): ${command} ${commandArgs.join(" ")}`);
  }

  return exitCodeJob.promise;
}

/**
 * Executes a command in Child Process mode using execa.
 * This mode separates stdout and stderr.
 */
async function runCp(pid: number, {command, commandArgs, json}: JunRunOptions, onStdout: (data: string) => void, onStdErr: (data: string) => void): Promise<number> {
  const junDir = await getJunDir();
  debug(`Spawning child_process with command: ${command} ${commandArgs.join(" ")}`);

  const cp = execa(command, commandArgs, {
    cwd: process.cwd(),
    env: process.env,
    all: true, // Interleave stdout and stderr in the `all` property
  });

  const log = (type: StdioLogEntry["type"], content: string) => writeLog(junDir, pid, {type, content, time: new Date().toISOString()});

  // Pipe stdout and stderr to both the logger and the console
  cp.stdout?.on("data", (data) => {
    const content = data.toString();
    log("stdout", content);
    if (!json) onStdout(data);
  });
  cp.stderr?.on("data", (data) => {
    const content = data.toString();
    log("stderr", content);
    if (!json) onStdErr(data);
  });

  await updateMeta(junDir, (tasks) => {
    const task = tasks.get(pid);
    if (task) task.osPid = cp.pid;
  });
  debug(`Foreground task ${pid} registered with OS PID: ${cp.pid}`);

  if (json) {
    console.log(JSON.stringify({status: "STARTED_IN_FOREGROUND", pid, osPid: cp.pid}));
  } else {
    console.log(`[jun] Started task ${pid} (OS PID: ${cp.pid}): ${command} ${commandArgs.join(" ")}`);
  }

  try {
    const result = await cp;
    return result.code;
  } catch (e: any) {
    // execa throws an error for non-zero exit codes
    return e.exitCode ?? 1;
  }
}

export async function junRunLogic(options: JunRunOptions): Promise<number> {
  const {command, commandArgs, json, output = "raw", mode = "tty"} = options;
  const junDir = await getJunDir();

  let formatOuput = (data: string) => data;
  if (output === "text") {
    formatOuput = stripAnsi;
  }
  if (output === "html") {
    const convert = new AnsiToHtmlConvert({stream: true});
    formatOuput = (data) => convert.toHtml(data);
  }

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
      output: "raw",
      mode,
    };
    tasks.set(newPid, task);
  });

  // --- Foreground task logic ---
  const exitCode = await (mode === "tty"
    ? //
      runTty(newPid, options, (data) => process.stdout.write(formatOuput(data)))
    : runCp(
        newPid,
        options,
        (data) => process.stdout.write(formatOuput(data)),
        (data) => process.stderr.write(formatOuput(data)),
      ));

  const endTime = new Date().toISOString();
  await updateMeta(junDir, (tasks) => {
    const task = tasks.get(newPid);
    if (task && task.status === "running") {
      task.status = exitCode === 0 ? "completed" : "error";
      task.endTime = endTime;
      task.osPid = undefined;
      debug(`Task ${newPid} status updated to ${task.status}`);
    }
  });

  if (!json) {
    const finalTask = (await readMeta(junDir)).get(newPid);
    console.log(`\n[jun] Task ${newPid} finished with status: ${finalTask?.status}`);
  }

  return exitCode;
}
