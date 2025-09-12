import {prompts} from "@gaubee/nodekit";
import {doInit, doSync, startWsServer, type SyncOptions} from "@jixo/dev/google-aistudio";
import type {Arguments, CommandModule} from "yargs";

// 定义 yargs builder 所需的参数接口
interface SyncArgs {
  path?: string;
  watch?: boolean;
  outDir?: string;
}

// 定义 'sync' 子命令
const syncCommand: CommandModule<object, SyncArgs> = {
  command: "sync [path]",
  aliases: ["S", "s"],
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
      })
      .option("outDir", {
        alias: "O",
        type: "string",
        describe: "Specify the output directory for generated markdown files",
      }),
  handler: async (argv: Arguments<SyncArgs>) => {
    // 将 yargs 的解析结果适配为 doSync 函数期望的格式。
    // 关键是 yargs 的位置参数是命名好的 (argv.path)，而 doSync
    // 期望它在 `_` 数组的第一个位置。
    const optionsForDoSync: SyncOptions = {
      ...argv,
      _: [argv.path as string],
    };
    doSync(optionsForDoSync);
  },
};

interface BrowserArgs {}

const browserCommand: CommandModule<object, BrowserArgs> = {
  command: "browser",
  aliases: ["B", "b"],
  describe: "browser-kit for aistudio.google.com",
  builder: (yargs) => yargs,
  handler: async () => {
    startWsServer();
  },
};
interface InitOptions {
  dir?: string;
  force?: boolean;
}
const initCommand: CommandModule<object, InitOptions> = {
  command: "init [dir]",
  aliases: ["i", "I"],
  describe: "init an browser-kit directory for aistudio.google.com",
  builder: (yargs) =>
    yargs
      .positional("dir", {
        describe: "Directory for aistudio input/output contents",
        type: "string",
      })
      .option("force", {
        alias: "F",
        type: "boolean",
        describe: "override exits files",
      }),
  handler: async (argv) => {
    let {dir} = argv;
    if (dir == null) {
      dir = await prompts.input({
        message: "No directory specified. Do you want to use the default '.ai' directory?",
        default: ".ai", // 默认值为 Yes
      });
    }
    doInit({
      ...argv,
      dir,
    });
  },
};

/**
 * @jixo/cli google-aistudio
 *
 * Group of commands for interacting with Google AI Studio.
 */
export const googleAistudioCommand: CommandModule<object, object> = {
  command: "google-aistudio <command>",
  aliases: ["GO", "Go", "go"],
  describe: "Commands for Google AI Studio integration",
  builder: (yargs) => {
    // 将 syncCommand 注册为 google-aistudio 的子命令
    return (
      yargs
        .command(syncCommand)
        .command(syncCommand)
        .command(browserCommand)
        .command(initCommand)
        //
        .demandCommand(1, "You must provide a sub-command for 'google-aistudio'.")
    );
  },
  // 这个 handler 理论上不会被执行，因为 yargs 会要求一个子命令
  handler: () => {},
};
