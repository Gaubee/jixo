import pty from "@lydell/node-pty";
import Debug from "debug";
import {execa, execaNode, type ResultPromise} from "execa";
import {import_meta_ponyfill} from "import-meta-ponyfill";
import {fileURLToPath} from "node:url";
import {getJunDir, readMeta, updateMeta, writeLog} from "../state.js";
import type {JunTask, JunTaskOutput, StdioLogEntry} from "../types.js";

const debug = Debug("jun:run");

// ANSI escape code regex
const ansiRegex = new RegExp(
  "[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]+)*)?\\u0007)|(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~]))",
  "g",
);

const stripAnsi = (str: string) => str.replace(ansiRegex, "");

export interface JunRunOptions {
  command: string;
  commandArgs: string[];
  background: boolean;
  json: boolean;
  output: JunTaskOutput;
  mode?: "tty" | "cp";
  onBackgroundProcess?: (processPromise: ResultPromise) => void;
}

/**
 * Executes a command in TTY mode using node-pty.
 * This mode provides a pseudo-terminal, mixing stdout and stderr.
 */
async function runTty(pid: number, {command, commandArgs, json, output}: JunRunOptions): Promise<number> {
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
      const contentToWrite = output === "text" ? stripAnsi(data) : data;
      process.stdout.write(contentToWrite);
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
async function runCp(pid: number, {command, commandArgs, json, output}: JunRunOptions): Promise<number> {
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
    if (!json) process.stdout.write(output === "text" ? stripAnsi(content) : content);
  });
  cp.stderr?.on("data", (data) => {
    const content = data.toString();
    log("stderr", content);
    if (!json) process.stderr.write(output === "text" ? stripAnsi(content) : content);
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
    return result.exitCode;
  } catch (e: any) {
    // execa throws an error for non-zero exit codes
    return e.exitCode ?? 1;
  }
}

export async function junRunLogic(options: JunRunOptions): Promise<number> {
  const {command, commandArgs, background, json, output, mode = "tty", onBackgroundProcess} = options;
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

  if (background) {
    debug("Starting background task");
    const cliPath = fileURLToPath(await import_meta_ponyfill(import.meta).resolve("#cli"));
    // Ensure the mode is passed to the background process
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

  // --- Foreground task logic ---
  const exitCode = await (mode === "tty" ? runTty(newPid, options) : runCp(newPid, options));

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
