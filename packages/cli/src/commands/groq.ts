import {prompts} from "@gaubee/nodekit";
import {doInit, startServe} from "../../../dev/dist/groq.bak/index.js";
import type {CommandModule} from "yargs";

// 定义 yargs builder 所需的参数接口

interface BrowserArgs {
  dir?: string;
}

const openaiApiCommand: CommandModule<object, BrowserArgs> = {
  command: "openai [dir]",
  aliases: ["ai", "A"],
  describe: "openai-api by console.groq.com",
  builder: (yargs) =>
    yargs
      .positional("dir", {
        describe: "Directory for aistudio output contents",
        type: "string",
        default: process.cwd(),
      })
      .option("port", {
        alias: "P",
        type: "number",
        describe: "Watch for browser response automatically",
        default: 18333,
      }),
  handler: async (argv) => {
    startServe({dir: argv.dir!, port: argv.port as number});
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
export const groqCommand: CommandModule<object, object> = {
  command: "groq <command>",
  aliases: [],
  describe: "Commands for Groq Playground integration",
  builder: (yargs) => {
    // 将 syncCommand 注册为 google-aistudio 的子命令
    return (
      yargs
        .command(openaiApiCommand)
        //
        .demandCommand(1, "You must provide a sub-command for 'groq'.")
    );
  },
  // 这个 handler 理论上不会被执行，因为 yargs 会要求一个子命令
  handler: () => {},
};
