import {cwdResolver} from "@gaubee/node";
import yargs from "yargs";
import {hideBin} from "yargs/helpers";
import packageJson from "../package.json" with {type: "json"};
import {doctor} from "./commands/doctor/index.js";
import {init} from "./commands/init.js";
import {run} from "./commands/tasks/run.js";
import {startDaemon, stopDaemon, statusDaemon, restartDaemon} from "./commands/daemon.js";

export const runCli = async (args: string[] = process.argv) => {
  const cli = await yargs(hideBin(args))
    .scriptName("jixo")
    .version(packageJson.version)
    .command(
      "doctor",
      "Check the requirements and health of the JIXO environment",
      (yargs) => yargs,
      () => {
        doctor();
      },
    )
    .command(
      "init [dir]",
      "Create a new JIXO project configuration",
      (yargs) => {
        return yargs.positional("dir", {
          describe: "The directory to create the JIXO config",
          default: "./",
        });
      },
      (argv) => {
        init(cwdResolver(argv.dir));
      },
    )
    .command(
      "run <goal>",
      "Run a JIXO job with a specific goal",
      (yargs) => {
        return yargs
          .positional("goal", {
            describe: "The high-level goal for the job",
            type: "string",
            demandOption: true,
          })
          .option("dir", {
            alias: "D",
            type: "string",
            description: "The project directory to run in",
            default: process.cwd(),
          })
          .option("loop", {
            alias: "L",
            type: "number",
            description: "The max loop times for the job",
            default: 20,
          });
      },
      (argv) => {
        run({
          jobGoal: argv.goal,
          workDir: cwdResolver(argv.dir),
          maxLoops: argv.loop,
        });
      },
    )
    .command("daemon <action>", "Manage the JIXO Core daemon", (yargs) => {
      return yargs
        .positional("action", {
          describe: "The action to perform on the daemon",
          type: "string",
          choices: ["start", "stop", "status", "restart"],
          demandOption: true,
        })
    }, (argv) => {
        switch (argv.action) {
            case 'start':
                startDaemon();
                break;
            case 'stop':
                stopDaemon();
                break;
            case 'status':
                statusDaemon();
                break;
            case 'restart':
                restartDaemon();
                break;
        }
    })
    .demandCommand(1, "You need at least one command before moving on")
    .strict()
    .help();

  const argv = await cli.parse();

  if (argv._.length === 0) {
    cli.showHelp();
    console.log(" " + "─".repeat(Math.max(4, process.stdout.columns - 2)));
    await doctor();
  }
};
