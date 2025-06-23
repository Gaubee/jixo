import {logger} from "@jixo/mcp-core";
import {import_meta_ponyfill} from "import-meta-ponyfill";
import yargs from "yargs";
import {hideBin} from "yargs/helpers";
import pkg from "../package.json" with {type: "json"};
import {startServer} from "./server.js";

async function main(args: string[] = process.argv) {
  const cli = await yargs(hideBin(args))
    .scriptName(Object.keys(pkg.bin)[0] ?? "mcp-fs")
    .version(pkg.version)
    .option("log", {
      alias: "L",
      type: "boolean",
    })
    .option("logFile", {
      type: "string",
    });
  const argv = await cli.parse();
  console.log(argv);
  if (argv.log) {
    const logFilename = argv.logFile || `${argv.$0}.log`;
    console.log("QAQ logFilename", logFilename);
    logger.setEnable(logFilename);
  }
  try {
    await startServer(argv._.map((a) => a.toString()));
  } catch (error) {
    console.error("Fatal error running server:", error);
    process.exit(1);
  }

  // const program = new Command();
  // program
  //   .name(Object.keys(pkg.bin)[0] ?? "mcp-fs")
  //   .version(pkg.version)
  //   .description("MCP Secure Filesystem Server")
  //   .option("-l, --log <path>", "enable logging")
  //   .argument("<allowed-directories...>", "List of directories the server is allowed to access.")
  //   .action(async (dirs) => {
  //     try {
  //       await startServer(dirs);
  //     } catch (error) {
  //       console.error("Fatal error running server:", error);
  //       process.exit(1);
  //     }
  //   });

  // await program.parseAsync(process.argv);
}

if (import_meta_ponyfill(import.meta).main) {
  main().catch((error) => {
    console.error("An unexpected error occurred:", error);
    process.exit(1);
  });
}
