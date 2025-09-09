import pty from "@lydell/node-pty";
import Debug from "debug";
import {execa, type ResultPromise} from "execa";
import {updateMeta, writeLog} from "../state.js";
import type {StdioLogEntry} from "../types.js";

const debug = Debug("jun:common");

export interface SpawnOptions {
  pid: number;
  junDir: string;
  command: string;
  args: string[];
  mode: "tty" | "cp";
  timeout?: number;
  idleTimeout?: number;
  onStdout?: (data: Buffer) => string;
  onStderr?: (data: Buffer) => string;
  onOutput?: (data: string) => string;
}

export type SpawnResult = SpawnTtyResult | SpawnCpResult;
interface SpawnBaseResult {
  pid: number;
  exitCode: number;
  isTimeout: boolean;
}
interface SpawnTtyResult extends SpawnBaseResult {
  mode: "tty";
  output: string; // Combined output for tty
}

interface SpawnCpResult extends SpawnBaseResult {
  mode: "cp";
  stdout: string;
  stderr: string;
}

export interface SpawnHandle {
  osPid: number;
  resultPromise: Promise<SpawnResult>;
}

export function spawnAndLog(options: SpawnOptions): SpawnHandle {
  const {pid, junDir, command, args, mode, timeout, idleTimeout, onStdout, onStderr, onOutput} = options;
  const controller = new AbortController();
  let isTimeout = false;
  let idleTimer: NodeJS.Timeout | undefined;

  const stdoutChunks: Buffer[] = [];
  const stderrChunks: Buffer[] = [];
  let allOutput = "";

  const disposeCallbacks = new Map<string, Function>();

  const log = (type: StdioLogEntry["type"], content: string) => {
    writeLog(junDir, pid, {type, content, time: new Date().toISOString()});
  };

  const resetIdleTimeout = () => {
    if (idleTimeout) {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        debug(`Task ${pid} timed out due to inactivity.`);
        isTimeout = true;
        controller.abort("Idle timeout");
      }, idleTimeout);
      disposeCallbacks.set("idleTimeout", () => {
        clearTimeout(idleTimer);
      });
    }
  };
  const startMainTimeout = () => {
    if (timeout) {
      const mainTimeout = setTimeout(() => {
        debug(`Task ${pid} timed out due to max execution time.`);
        isTimeout = true;
        controller.abort("Timeout");
      }, timeout);
      disposeCallbacks.set("timeout", () => {
        clearTimeout(mainTimeout);
      });
    }
  };

  let childProcess: {type: "tty"; cp: pty.IPty} | {type: "cp"; cp: ResultPromise};
  let osPid: number;

  const resultPromiseJob = Promise.withResolvers<SpawnResult>();
  resultPromiseJob.promise.finally(() => {
    for (const callback of disposeCallbacks.values()) {
      try {
        callback();
      } catch {}
    }
  });

  if (mode === "tty") {
    const ptyProcess = pty.spawn(command, args, {
      name: "xterm-color",
      cols: process.stdout.columns || 80,
      rows: process.stdout.rows || 30,
      cwd: process.cwd(),
      env: process.env as {[key: string]: string},
    });
    childProcess = {type: "tty", cp: ptyProcess};
    osPid = ptyProcess.pid;

    ptyProcess.onData((data) => {
      resetIdleTimeout();
      allOutput += data;
      log("output", onOutput ? onOutput(data) : data);
    });

    ptyProcess.onExit(({exitCode}) => {
      resultPromiseJob.resolve({
        pid,
        exitCode,
        isTimeout,
        mode: "tty",
        output: allOutput,
      });
    });
  } else {
    // mode === 'cp'
    const cp = execa(command, args, {
      cwd: process.cwd(),
      env: process.env,
      cancelSignal: controller.signal,
      all: true,
    });
    childProcess = {type: "cp", cp};
    if (cp.pid == null) {
      throw new Error(`fail to exec child process: ${command} ${args.join(" ")}`);
    }
    osPid = cp.pid;

    cp.stdout?.on("data", (data) => {
      resetIdleTimeout();
      const chunk = Buffer.from(data);
      stdoutChunks.push(chunk);
      log("stdout", onStdout ? onStdout?.(chunk) : chunk.toString());
    });

    cp.stderr?.on("data", (data) => {
      resetIdleTimeout();
      const chunk = Buffer.from(data);
      stderrChunks.push(chunk);
      log("stderr", onStderr ? onStderr?.(chunk) : chunk.toString());
    });

    cp.then(
      (result) => {
        resultPromiseJob.resolve({
          pid,
          exitCode: result.exitCode ?? 0,
          isTimeout,
          mode: "cp",
          stdout: Buffer.concat(stdoutChunks).toString("utf-8"),
          stderr: Buffer.concat(stderrChunks).toString("utf-8"),
        });
      },
      (e) => {
        resultPromiseJob.resolve({
          pid,
          exitCode: e.exitCode ?? 1,
          isTimeout,
          mode: "cp",
          stdout: Buffer.concat(stdoutChunks).toString("utf-8"),
          stderr: Buffer.concat(stderrChunks).toString("utf-8"),
        });
      },
    );
  }

  startMainTimeout(); // start the main timer
  resetIdleTimeout(); // Start the first idle timer

  {
    const onAbort = () => {
      if (childProcess.type === "cp" && childProcess.cp.exitCode == null) {
        childProcess.cp.kill("SIGTERM");
      }
      if (childProcess.type === "tty") {
        childProcess.cp.kill("SIGTERM");
      }
    };
    controller.signal.addEventListener("abort", onAbort);
    disposeCallbacks.set("abort", () => {
      controller.signal.removeEventListener("abort", onAbort);
    });
  }

  return {osPid, resultPromise: resultPromiseJob.promise};
}

export async function updateTaskCompletion(junDir: string, result: SpawnResult) {
  const endTime = new Date().toISOString();
  await updateMeta(junDir, (tasks) => {
    const task = tasks.get(result.pid);
    if (task && task.status === "running") {
      task.status = result.exitCode === 0 ? "completed" : "error";
      if (result.isTimeout) {
        task.status = "killed";
      }
      task.endTime = endTime;
      task.osPid = undefined;
      debug(`Task ${result.pid} status updated to ${task.status}`);
    }
  });
}
