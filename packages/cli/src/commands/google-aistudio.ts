import {reactiveFs, sync} from "@jixo/dev/google-aistudio/jixo";
import type {Arguments, CommandModule} from "yargs";
import z from "zod";

interface SyncArgs {
  path?: string;
  watch?: boolean;
}

// 定义 'sync' 子命令
const syncCommand: CommandModule<object, SyncArgs> = {
  command: "sync [path]",
  aliases: ["S"],
  describe: "Sync with aistudio.google.com contents",
  builder: (yargs) =>
    yargs
      .positional("path", {
        describe: "Directory or file path to sync",
        type: "string",
        default: process.cwd(),
      })
      .option("watch", {
        alias: "W",
        type: "boolean",
        describe: "Watch for file changes and sync automatically",
        default: false,
      }),
  handler: async (argv: Arguments<SyncArgs>) => {
    reactiveFs.use(
      async () => {
        // 使用 Zod 对路径进行安全解析，即使有默认值也确保类型正确
        const targetPath = z.string().parse(argv.path);
        await sync(targetPath);
      },
      {
        once: !argv.watch,
      },
    );

    if (argv.watch) {
      console.log("\nWatching for file changes... Press Ctrl+C to exit.");
    }
  },
};

/**
 * @jixo/cli google-aistudio
 *
 * Group of commands for interacting with Google AI Studio.
 */
export const googleAistudioCommand: CommandModule<object, object> = {
  command: "google-aistudio <command>",
  aliases: ["GO"],
  describe: "Commands for Google AI Studio integration",
  builder: (yargs) => {
    // 将 syncCommand 注册为 google-aistudio 的子命令
    return yargs.command(syncCommand).demandCommand(1, "You must provide a sub-command for 'google-aistudio'.");
  },
  // 这个 handler 理论上不会被执行，因为 yargs 会要求一个子命令
  handler: () => {},
};
