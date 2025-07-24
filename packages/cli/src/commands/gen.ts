import {doGenPrompts, type GenOptions} from "@jixo/dev/gen-prompt";
import type {Arguments, CommandModule} from "yargs";

/**
 * @jixo/cli gen
 *
 * Generate AI prompts from metadata files (*.meta.md).
 */
export const genCommand: CommandModule<object, GenOptions> = {
  command: "gen <inputs...>",
  aliases: ["G"],
  describe: "Generate AI prompts from metadata files (*.meta.md)",
  builder: (yargs) =>
    yargs
      .positional("inputs", {
        describe: "Input files, directories, or glob patterns",
        type: "string",
        demandOption: true,
        array: true,
      })
      .option("outFile", {
        alias: ["O", "out-file"],
        type: "string",
        describe: "Specify the output file path (for single file input only)",
      })
      .option("watch", {
        alias: "W",
        type: "boolean",
        describe: "Watch for file changes and regenerate automatically",
        default: false,
      })
      .option("cwd", {
        type: "string",
        describe: "Set the working directory for glob patterns",
      })
      .option("glob", {
        type: "string",
        describe: "Glob pattern for batch processing when an input is a directory",
        default: "*.meta.md",
      }),
  handler: async (argv: Arguments<GenOptions>) => {
    // 直接调用封装好的核心逻辑
    await doGenPrompts(argv);
  },
};
