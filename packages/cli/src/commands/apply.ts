import {applyAiResponse} from "@jixo/dev/apply-ai-response";
import type {Arguments, CommandModule} from "yargs";

interface ApplyArgs {
  files: string[];
  yes: boolean;
  cwd: string;
  unsafe: boolean;
  format: boolean;
  gitCommit: boolean;
}

/**
 * @jixo/cli apply
 *
 * Apply changes from AI-generated markdown file.
 */
export const applyCommand: CommandModule<object, ApplyArgs> = {
  command: "apply <files...>",
  aliases: ["A"],
  describe: "Apply changes from AI-generated markdown files",
  builder: (yargs) =>
    yargs
      .positional("files", {
        describe: "Paths or glob patterns to the markdown files",
        type: "string",
        demandOption: true,
        array: true, // Corrected: This makes TS infer string[]
      })
      .option("yes", {
        alias: "Y",
        type: "boolean",
        describe: "Skip confirmation prompt and apply all changes",
        default: false,
      })
      .option("cwd", {
        alias: "C",
        type: "string",
        describe: "Set the working directory",
        default: process.cwd(),
      })
      .option("unsafe", {
        type: "boolean",
        describe: "Allow unsafe file paths (e.g., outside of project root)",
        default: false,
      })
      .option("format", {
        alias: "F",
        type: "boolean",
        describe: "Format code after applying changes",
        default: true,
      })
      .option("gitCommit", {
        alias: ["G", "git-commit"],
        type: "boolean",
        describe: "Automatically commit changes with the message from markdown",
        default: false,
      }),
  handler: async (argv: Arguments<ApplyArgs>) => {
    // With array: true, argv.files is now correctly typed as string[]
    await applyAiResponse(argv.files, {
      yes: argv.yes,
      cwd: argv.cwd,
      unsafe: argv.unsafe,
      format: argv.format,
      gitCommit: argv.gitCommit,
    });
  },
};
