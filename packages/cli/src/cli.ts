import {cwdResolver} from "@gaubee/node";
import yargs from "yargs";
import {hideBin} from "yargs/helpers";
import {init} from "./commands/init";
import {run} from "./commands/run";

export const runCli = async (args: string[] = process.argv) => {
  const _argv = await yargs(hideBin(args))
    .command(
      "init [dir]",
      "Create a new prompt-gen project",
      (yargs) => {
        return yargs;
      },
      (argv) => {
        init(cwdResolver(...argv._.filter((v) => typeof v === "string").slice(0, 1)));
      },
    )
    .command(
      "run [filter:...]",
      "Run prompt-gen tasks",
      (yargs) => {
        return yargs.option("dir", {type: "string"});
      },
      (argv) => {
        const filters = argv._.map((v) => v.toString().split(/[\s,]+/)).flat();
        const nameFilter = filters.filter((f) => !f.startsWith("./"));
        const dirFilter = filters.filter((f) => f.startsWith("./"));
        run(argv.dir ? cwdResolver(argv.dir) : cwdResolver(), {nameFilter, dirFilter});
      },
    )
    .parse();
};
