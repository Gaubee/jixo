import {cwdResolver} from "@gaubee/node";
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
          });
      },
      (argv) => {
        const filters = argv.filter.map((v) => v.toString().split(/[\s,]+/)).flat();
        const nameFilter = filters.filter((f) => !f.startsWith("./"));
        const dirFilter = filters.filter((f) => f.startsWith("./"));
        run(cwdResolver(argv.dir ?? ""), {nameFilter, dirFilter});
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
