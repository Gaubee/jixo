import type {JunRunCliOptions} from "../cli/run.js";
import type {JunTaskOutput} from "../types.js";

/**
 * Parses the arguments specifically for the 'run' command.
 * It correctly handles the `--` separator to distinguish jun's options
 * from the command to be executed.
 * @param args - The array of string arguments passed after 'jun run'.
 * @returns A structured options object for junRunLogic.
 */
export function parseRunArgs(args: string[]): JunRunCliOptions | {error: string} {
  let json = false;
  let output: JunTaskOutput = "raw";
  let mode: "tty" | "cp" = "cp";
  let timeout: number | undefined;
  let idleTimeout: number | undefined;
  let commandIndex = -1;

  // First, find the command and separate jun's flags from the command's args.
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--") {
      commandIndex = i + 1;
      break;
    }

    if (arg === "--json") {
      json = true;
      continue;
    }

    if (arg === "--output" || arg === "-o") {
      const value = args[i + 1] as JunTaskOutput;
      if (!["raw", "text", "html"].includes(value)) {
        return {error: `Invalid output format: ${value}. Must be 'raw', 'text', or 'html'.`};
      }
      output = value;
      i++; // Skip the next argument since we've consumed it.
      continue;
    }

    if (arg === "--mode" || arg === "-m") {
      const value = args[i + 1] as "tty" | "cp";
      if (value !== "tty" && value !== "cp") {
        return {error: `Invalid mode: ${value}. Must be 'tty' or 'cp'.`};
      }
      mode = value;
      i++; // Skip the next argument
      continue;
    }

    if (arg === "--timeout") {
      timeout = Number(args[i + 1]);
      if (isNaN(timeout)) return {error: "Invalid timeout value."};
      i++;
      continue;
    }

    if (arg === "--idle-timeout") {
      idleTimeout = Number(args[i + 1]);
      if (isNaN(idleTimeout)) return {error: "Invalid idle-timeout value."};
      i++;
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
    json,
    output,
    mode,
    timeout,
    idleTimeout,
  };
}
