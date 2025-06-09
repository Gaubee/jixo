import {cwdResolver} from "@gaubee/node";
import {match, P} from "ts-pattern";
import yargs from "yargs";
import {hideBin} from "yargs/helpers";
import {doctor} from "./commands/doctor/index.js";
import {init} from "./commands/init.js";
import {listPrompts} from "./commands/prompts/list.js";
import {upgradePrompts} from "./commands/prompts/upgrade.js";
import {run} from "./commands/tasks/run.js";

export const runCli = async (args: string[] = process.argv) => {
  const cli = await yargs(hideBin(args))
    .scriptName("jixo")
    .command(
      "doctor",
      "Check the requirements for run jixo",
      (yargs) => yargs,
      () => {
        doctor();
      },
    )
    .command(
      "init [dir]",
      "Create a new JIXO project",
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
      "run [filter...]",
      "Run JIXO tasks",
      (yargs) => {
        return yargs
          .positional("filter", {
            describe: 'Fliter tasks by name or directory(starts with "./")',
            array: true,
            default: [],
          })
          .option("dir", {
            alias: "D",
            type: "string",
            description: "The project directory with JIXO config",
          })
          .option("force", {
            alias: "F",
            type: "boolean",
            description: "Tasks are forced to run, even at 100% progress. It is suitable for running after modifying the content of the task",
          })
          .option("once", {
            alias: "O",
            type: "boolean",
            description: "The task is executed only once in the loop, equal to --step=1",
          })
          .option("step", {
            alias: "S",
            type: "number",
            description: "The task is executed N times in the loop",
          });
      },
      (argv) => {
        const filters = argv.filter.map((v) => v.toString().split(/[\s,]+/)).flat();
        const nameFilter: string[] = [];
        const dirFilter: string[] = [];
        for (const f of filters) {
          if (f.startsWith("./") || f.startsWith("../") || f.startsWith("~/")) {
            dirFilter.push(f);
          } else {
            nameFilter.push(f);
          }
        }
        run(cwdResolver(argv.dir ?? ""), {
          nameFilter,
          dirFilter,
          force: argv.force,
          loopTimes: match(argv)
            .with({step: P.number.gt(0).select()}, (step) => step)
            .with({once: P.boolean.select()}, (once) => (once ? 1 : Infinity))
            .otherwise(() => Infinity),
        });
      },
    )
    .command(
      "prompts",
      "Manage prompts",
      (yargs) => {
        return (
          yargs
            //
            .option("dir", {
              alias: "D",
              type: "string",
              description: "The project directory with JIXO config",
            })
            .option("mirrorUrl", {
              alias: "M",
              type: "string",
              description: "The Url for download prompts",
            })
            .option("upgrade", {
              alias: "U",
              type: "boolean",
              description: "Upgrade builtin prompts",
            })
        );
      },
      async (argv) => {
        if (argv.upgrade) {
          upgradePrompts(argv.dir ? cwdResolver(argv.dir) : cwdResolver(), {mirrorUrl: argv.mirrorUrl});
        } else {
          listPrompts();
        }
      },
    )
    .strict();
  const argv = await cli.parse();

  if (argv._.length === 0) {
    cli.showHelp();
    console.log(" " + "─".repeat(Math.max(4, process.stdout.columns - 2)));
    await doctor();
  }
};
