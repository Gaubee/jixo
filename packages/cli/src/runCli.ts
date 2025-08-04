process.removeAllListeners("warning");
import yargs from "yargs";
import {hideBin} from "yargs/helpers";
import packageJson from "../package.json" with {type: "json"};
import {applyCommand} from "./commands/apply.js";
import {genCommand} from "./commands/gen.js";
import {googleAistudioCommand} from "./commands/google-aistudio.js";
import {groqCommand} from "./commands/groq.js";

export const runCli = async (args: string[] = process.argv) => {
  let cli = yargs(hideBin(args))
    // jixo cli
    .scriptName("jixo")
    .version(packageJson.version)
    .demandCommand(1, "You need at least one command before moving on")
    .strict()
    .help()
    .command(applyCommand)
    .command(genCommand)
    .command(googleAistudioCommand)
    .command(groqCommand);

  const argv = await cli.parse();

  // 如果没有命令被执行，显示帮助信息
  if (argv._.length === 0) {
    cli.showHelp();
    console.log(" " + "─".repeat(Math.max(4, process.stdout.columns - 2)));
  }
};
