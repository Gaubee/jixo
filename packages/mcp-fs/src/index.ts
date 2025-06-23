import {logger} from "@jixo/mcp-core";
import {import_meta_ponyfill} from "import-meta-ponyfill";
import yargs from "yargs";
import {hideBin} from "yargs/helpers";
import pkg from "../package.json" with {type: "json"};
import {startServer} from "./server.js";

async function main(args: string[] = process.argv) {
  const cli = yargs(hideBin(process.argv))
    .scriptName(Object.keys(pkg.bin)[0] ?? "mcp-fs")
    .version(pkg.version)
    .usage("MCP Secure Filesystem Server\n\nUsage: $0 [options] <allowed-directories...>")
    // 定义默认命令及其参数。
    // '$0' 代表根命令。
    // '<dirs...>' 定义了一个名为 'dirs' 的位置参数。
    // '<...>' 表示它是必需的。
    // '...' 表示它可以接受多个值，yargs 会将它们收集到一个数组中。
    .command(
      "$0 <allowed-directories...>",
      "Starts the MCP filesystem server with specified accessible directories.",
      (yargs) => {
        // 构建选项
        return (
          yargs // 检查是否至少提供了一个必需的 <dirs...> 参数
            // .demandCommand(1, "You must provide at least one directory path for the server to access.")
            .positional("allowed-directories", {
              demandOption: false,
              normalize: true,
              describe: "List of directories the server is allowed to access.",
            })
            .option("log", {
              type: "boolean",
              alias: "L",
              describe: "Enable logging",
            })
            .option("logFile", {
              type: "string",
              describe: "Enable logging to a specified file path",
            })
        );
      },
      async (argv) => {
        if (argv.log || argv.logFile) {
          const logFilename = argv.logFile || `${argv.$0}.log`;
          logger.setEnable(logFilename);
        }
        try {
          // 命令处理器
          await startServer(argv.allowedDirectories as unknown as string[]);
        } catch (error) {
          console.error("Fatal error running server:", error);
          process.exit(1);
        }
      },
    )
    // 启用标准的 --help 选项
    .help()
    .alias("help", "h")
    // .strict() 会让 yargs 对未知命令或参数报错，增加健壮性
    .strict()
    // 触发解析和执行
    .parse();
}

if (import_meta_ponyfill(import.meta).main) {
  main().catch((error) => {
    console.error("An unexpected error occurred:", error);
    process.exit(1);
  });
}
