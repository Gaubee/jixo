import type {JunStartCliOptions} from "../cli/start.js";
import type {JunTaskOutput} from "../types.js";

/**
 * Parses the arguments specifically for the 'start' command.
 * @param args - The array of string arguments passed after 'jun start'.
 * @returns A structured options object for junStartLogic.
 */
export function parseStartArgs(args: string[]): JunStartCliOptions | {error: string} {
  let json = false;
  let output: JunTaskOutput = "raw";
  let mode: "tty" | "cp" = "tty";
  let commandIndex = -1;

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
      i++;
      continue;
    }

    if (arg === "--mode" || arg === "-m") {
      const value = args[i + 1] as "tty" | "cp";
      if (value !== "tty" && value !== "cp") {
        return {error: `Invalid mode: ${value}. Must be 'tty' or 'cp'.`};
      }
      mode = value;
      i++;
      continue;
    }

    // The first argument that is not a recognized flag is the command.
    commandIndex = i;
    break;
  }

  if (commandIndex === -1 || commandIndex >= args.length) {
    return {error: 'No command specified for "start".'};
  }

  const commandAndArgs = args.slice(commandIndex);
  const [command, ...commandArgs] = commandAndArgs;

  return {
    command,
    commandArgs,
    json,
    output,
    mode,
  };
}
