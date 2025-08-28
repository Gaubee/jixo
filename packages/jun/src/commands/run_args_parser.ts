import type {JunRunOptions} from "./run.ts";

/**
 * Parses the arguments specifically for the 'run' command.
 * It correctly handles the `--` separator to distinguish jun's options
 * from the command to be executed.
 * @param args - The array of string arguments passed after 'jun run'.
 * @returns A structured options object for junRunLogic.
 */
export function parseRunArgs(args: string[]): JunRunOptions | {error: string} {
  let background = false;
  let json = false;
  let commandIndex = -1;

  // First, find the command and separate jun's flags from the command's args.
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--") {
      commandIndex = i + 1;
      break;
    }

    if (arg === "--background" || arg === "-b") {
      background = true;
      continue;
    }

    if (arg === "--json") {
      json = true;
      continue;
    }

    // The first non-flag argument is the command.
    if (!arg.startsWith("-")) {
      commandIndex = i;
      break;
    }
  }

  if (commandIndex === -1 || commandIndex >= args.length) {
    return {error: 'No command specified for "run".'};
  }

  const commandAndArgs = args.slice(commandIndex);
  const [command, ...commandArgs] = commandAndArgs;

  return {
    command,
    commandArgs,
    background,
    json,
  };
}
