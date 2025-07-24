import {gen_prompt} from "@jixo/dev/gen-prompt";
import {globbySync, isDynamicPattern} from "globby";
import fs from "node:fs";
import path from "node:path";
import type {Arguments, CommandModule} from "yargs";

interface GenArgs {
  inputs: string[];
  outFile?: string;
  watch: boolean;
  cwd?: string;
  glob: string;
}

/**
 * @jixo/cli gen
 *
 * Generate AI prompts from metadata files (*.meta.md).
 */
export const genCommand: CommandModule<object, GenArgs> = {
  command: "gen <inputs...>",
  aliases: ["G"],
  describe: "Generate AI prompts from metadata files (*.meta.md)",
  builder: (yargs) =>
    yargs
      .positional("inputs", {
        describe: "Input files, directories, or glob patterns",
        type: "string",
        demandOption: true,
        array: true, // Corrected: This makes TS infer string[]
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
  handler: async (argv: Arguments<GenArgs>) => {
    const once = !argv.watch;
    const CWD = argv.cwd || process.cwd();

    // With array: true, argv.inputs is now correctly typed as string[]
    const inputs = argv.inputs;

    for (const input of inputs) {
      const resolvedInput = path.resolve(CWD, input);

      if (isDynamicPattern(input)) {
        const files = globbySync(input, {cwd: CWD});
        console.log(`Glob pattern '${input}' matched ${files.length} files.`);
        for (const file of files) {
          // When using globs, output file is determined automatically by gen_prompt
          await gen_prompt(file, once, undefined, CWD);
        }
      } else if (fs.existsSync(resolvedInput)) {
        const stat = fs.statSync(resolvedInput);
        if (stat.isFile()) {
          await gen_prompt(input, once, argv.outFile, CWD);
        } else if (stat.isDirectory()) {
          console.log(`Processing directory '${input}' with glob '${argv.glob}'...`);
          const files = globbySync(argv.glob, {cwd: resolvedInput});
          console.log(`Found ${files.length} files to process.`);
          for (const file of files) {
            const fullPath = path.join(input, file);
            await gen_prompt(fullPath, once, undefined, CWD);
          }
        }
      } else {
        console.warn(`Warning: Input path does not exist, but treating as a potential glob: ${input}`);
        const files = globbySync(input, {cwd: CWD});
        if (files.length > 0) {
          for (const file of files) {
            await gen_prompt(file, once, undefined, CWD);
          }
        } else {
          console.error(`Error: Input '${input}' not found and did not match any files.`);
        }
      }
    }

    if (argv.watch) {
      console.log("\nWatching for file changes... Press Ctrl+C to exit.");
    }
  },
};
