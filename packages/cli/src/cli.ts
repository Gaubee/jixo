import yargs from "yargs";
import {hideBin} from "yargs/helpers";
import packageJson from "../package.json" with {type: "json"};

export const runCli = async (args: string[] = process.argv) => {
  const cli = await yargs(hideBin(args))
    .scriptName("jixo")
    .version(packageJson.version)

    .demandCommand(1, "You need at least one command before moving on")
    .strict()
    .help();

  const argv = await cli.parse();

  if (argv._.length === 0) {
    cli.showHelp();
    console.log(" " + "─".repeat(Math.max(4, process.stdout.columns - 2)));
  }
};
