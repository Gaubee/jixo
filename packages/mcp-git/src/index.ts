import {logger} from "@jixo/mcp-core";
import {import_meta_ponyfill} from "import-meta-ponyfill";
import yargs from "yargs";
import {hideBin} from "yargs/helpers";
import pkg from "../package.json" with {type: "json"};
import {startServer} from "./server.js";

async function main(args = process.argv) {
  const _cli = await yargs(hideBin(args))
    .scriptName(Object.keys(pkg.bin)[0] ?? "mcp-git")
    .usage("MCP Git Server - Git functionality for MCP")
    .version(pkg.version)
    .command(
      "$0",
      "Starts the MCP Git server.",
      (yargs) => {
        // 这个函数用于构建该命令的选项
        return yargs
          .option("repository", {
            alias: "r",
            type: "string",
            describe: "Git repository path",
            // demandOption: true 使其成为必需选项，对应 commander 的 <path>
            // demandOption: true,
          })
          .option("log", {
            type: "boolean",
            alias: "L",
            describe: "Enable logging",
          })
          .option("logFile", {
            type: "string",
            describe: "Enable logging to a specified file path",
          });
      },
      async (argv) => {
        if (argv.log || argv.logFile) {
          const logFilename = argv.logFile || `${argv.$0}.log`;
          logger.setEnable(logFilename);
        }
        try {
          await startServer(argv.repository);
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
