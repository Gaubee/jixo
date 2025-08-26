#!/usr/bin/env -S deno run --allow-read --allow-write --allow-run --allow-env

import {parseArgs} from "@std/cli";
import {format as formatDate} from "@std/datetime";
import {junCatLogic} from "./src/commands/cat.ts";
import {junHistoryLogic} from "./src/commands/history.ts";
import {junInitLogic} from "./src/commands/init.ts";
import {junKillLogic} from "./src/commands/kill.ts";
import {junLsLogic} from "./src/commands/ls.ts";
import {junRmLogic} from "./src/commands/rm.ts";
import {junRunLogic} from "./src/commands/run.ts";
import type {JunTask, JunTaskLog} from "./src/types.ts";

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
    console.log(`[${time}][${log.type}] ${log.content.trimEnd()}`);
  }
}

export async function main(argsArray: string[]): Promise<number> {
  if (argsArray.length === 0) {
    console.error("No command provided.");
    console.log("Available commands: init, run, ls, history, cat, rm, kill");
    return 1;
  }

  const command = argsArray[0];
  const commandArgs = argsArray.slice(1);

  // Key Fix: Handle 'run' command separately, passing remaining args without parsing them.
  if (command === "run") {
    if (commandArgs.length === 0) {
      console.error('Error: No command specified for "run".');
      return 1;
    }
    const [cmd, ...restArgs] = commandArgs;
    return await junRunLogic(cmd, restArgs);
  }

  // For all other commands, parse the arguments.
  const args = parseArgs(commandArgs, {boolean: ["json", "all", "auto"], string: ["_"]});

  switch (command) {
    case "init": {
      const junDir = await junInitLogic();
      console.log(`Jun directory initialized at: ${junDir}`);
      break;
    }
    case "ls": {
      const runningTasks = await junLsLogic();
      if (args.json) console.log(JSON.stringify(runningTasks, null, 2));
      else printTasks(runningTasks);
      break;
    }
    case "history": {
      const allTasks = await junHistoryLogic();
      if (args.json) console.log(JSON.stringify(allTasks, null, 2));
      else printTasks(allTasks);
      break;
    }
    case "cat": {
      const pids = args._.map(Number).filter((n) => !isNaN(n) && n > 0);
      if (pids.length === 0) {
        console.error('Error: No valid PID specified for "cat".');
        return 1;
      }
      const {success, failed} = await junCatLogic(pids);
      if (args.json) console.log(JSON.stringify({success, failed}, null, 2));
      else {
        for (const taskLog of Object.values(success)) {
          printTaskLogs(taskLog);
        }
        for (const [pid, error] of Object.entries(failed)) {
          console.error(`Error for PID ${pid}: ${error}`);
        }
      }
      break;
    }
    case "rm": {
      const pids = args._.map(Number).filter((n) => !isNaN(n) && n > 0);
      if (pids.length === 0 && !args.all && !args.auto) {
        console.error('Error: No valid PIDs specified for "rm".');
        return 1;
      }
      const {removed, skipped} = await junRmLogic({pids, all: args.all, auto: args.auto});
      for (const [pid, reason] of Object.entries(skipped)) {
        console.warn(`Skipping PID ${pid}: ${reason}`);
      }
      console.log(`Removed ${removed.length} task(s).`);
      break;
    }
    case "kill": {
      const pids = args._.map(Number).filter((n) => !isNaN(n) && n > 0);
      if (pids.length === 0 && !args.all) {
        console.error('Error: No valid PIDs specified for "kill".');
        return 1;
      }
      const {killedCount, failedPids} = await junKillLogic({pids, all: args.all});
      for (const [pid, error] of Object.entries(failedPids)) console.error(`Failed to kill task PID ${pid}: ${error}`);
      console.log(`Killed ${killedCount} task(s).`);
      break;
    }
    default:
      console.error(`Unknown command: ${command}`);
      console.log("Available commands: init, run, ls, history, cat, rm, kill");
      return 1;
  }
  return 0;
}

if (import.meta.main) {
  Deno.exit(await main(Deno.args));
}

// JIXO_CODER_EOF
