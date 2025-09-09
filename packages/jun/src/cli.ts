#!/usr/bin/env node
import {format as formatDate} from "date-fns";
import yargsParser from "yargs-parser";
import {junCatLogic} from "./commands/cat.js";
import {junHistoryLogic} from "./commands/history.js";
import {junInitLogic} from "./commands/init.js";
import {junKillLogic} from "./commands/kill.js";
import {junLsLogic} from "./commands/ls.js";
import {junRmLogic} from "./commands/rm.js";
import {parseRunArgs} from "./commands/run_args_parser.js";
import {parseStartArgs} from "./commands/start_args_parser.js";
import type {JunTask, JunTaskLog} from "./types.js";

function printTasks(tasks: JunTask[]) {
  if (tasks.length === 0) {
    console.log("No tasks to display.");
    return;
  }
  console.log("PID\tSTATUS\t\tSTART_TIME\t\tCOMMAND");
  console.log("---\t------\t\t----------\t\t-------");
  for (const task of tasks) {
    const commandStr = `${task.command} ${task.args.join(" ")}`.slice(0, 50);
    const startTime = formatDate(new Date(task.startTime), "yyyy-MM-dd HH:mm:ss");
    console.log(`${task.pid}\t${task.status.padEnd(8)}\t${startTime}\t${commandStr}`);
  }
}

function printTaskLogs(taskLog: JunTaskLog) {
  console.log(`--- Log for PID ${taskLog.pid}: ${taskLog.command} ${taskLog.args.join(" ")} ---`);
  for (const log of taskLog.stdio) {
    const time = formatDate(new Date(log.time), "HH:mm:ss.SSS");
    // Differentiate log output based on type for clarity
    const prefix = log.type === "output" ? "" : `[${log.type}] `;
    console.log(`[${time}]${prefix}${log.content.trimEnd()}`);
  }
}

export async function main(argsArray: string[]): Promise<number> {
  if (argsArray.length === 0) {
    console.error("No command provided.");
    console.log("Available commands: init, run, start, ls, history, cat, rm, kill");
    return 1;
  }

  const command = argsArray[0];
  const commandArgs = argsArray.slice(1);
  const commonArgs = yargsParser(commandArgs, {
    boolean: ["json", "all", "auto"],
    string: ["output", "timeout", "idle-timeout"],
    alias: {o: "output"},
    configuration: {"strip-dashed": true},
  });

  switch (command) {
    case "init": {
      const junDir = await junInitLogic();
      console.log(`Jun directory initialized at: ${junDir}`);
      return 0;
    }
    case "start": {
      const startOpts = parseStartArgs(commandArgs);
      if ("error" in startOpts) {
        console.error(`Error: ${startOpts.error}`);
        return 1;
      }
      return await junStartLogicForCli(startOpts);
    }
    case "ls": {
      const runningTasks = await junLsLogic();
      if (commonArgs.json) console.log(JSON.stringify(runningTasks, null, 2));
      else printTasks(runningTasks);
      return 0;
    }
    case "history": {
      const allTasks = await junHistoryLogic();
      if (commonArgs.json) console.log(JSON.stringify(allTasks, null, 2));
      else printTasks(allTasks);
      return 0;
    }
    case "cat": {
      const pids = commonArgs._.map(Number).filter((n) => !isNaN(n) && n > 0);
      if (pids.length === 0) {
        console.error('Error: No valid PID specified for "cat".');
        return 1;
      }
      const {success, failed} = await junCatLogic(pids);
      if (commonArgs.json) console.log(JSON.stringify({success, failed}, null, 2));
      else {
        for (const taskLog of Object.values(success)) {
          printTaskLogs(taskLog);
        }
        for (const [pid, error] of Object.entries(failed)) {
          console.error(`Error for PID ${pid}: ${error}`);
        }
      }
      return 0;
    }
    case "rm": {
      const pids = commonArgs._.map(Number).filter((n) => !isNaN(n) && n > 0);
      if (pids.length === 0 && !commonArgs.all && !commonArgs.auto) {
        console.error('Error: No valid PIDs specified for "rm".');
        return 1;
      }
      const {removed, skipped} = await junRmLogic({pids, all: commonArgs.all, auto: commonArgs.auto});
      for (const [pid, reason] of Object.entries(skipped)) {
        console.warn(`Skipping PID ${pid}: ${reason}`);
      }
      console.log(`Removed ${removed.length} task(s).`);
      return 0;
    }
    case "kill": {
      const pids = commonArgs._.map(Number).filter((n) => !isNaN(n) && n > 0);
      if (pids.length === 0 && !commonArgs.all) {
        console.error('Error: No valid PIDs specified for "kill".');
        return 1;
      }
      const {killedCount, failedPids} = await junKillLogic({pids, all: commonArgs.all});
      for (const [pid, error] of Object.entries(failedPids)) console.error(`Failed to kill task PID ${pid}: ${error}`);
      console.log(`Killed ${killedCount} task(s).`);
      return 0;
    }
    default: {
      // Default behavior: treat the command as a 'run' command.
      const runOpts = parseRunArgs(command === "run" ? commandArgs : argsArray); // Parse the original, full args array.
      if ("error" in runOpts) {
        console.error(`Unknown command: ${command}`);
        console.log("Available commands: init, run, start, ls, history, cat, rm, kill");
        return 1;
      }
      return await junRunLogicForCli(runOpts);
    }
  }
}

import {import_meta_ponyfill} from "import-meta-ponyfill";
import {junRunLogicForCli} from "./cli/run.js";
import {junStartLogicForCli} from "./cli/start.js";

if (import_meta_ponyfill(import.meta).main) {
  main(process.argv.slice(2)).then((exitCode) => {
    process.exit(exitCode);
  });
}
