import {Command} from "commander";
import {import_meta_ponyfill} from "import-meta-ponyfill";
import pkg from "../package.json" with {type: "json"};
import {startServer} from "./server.js";

async function main() {
  const program = new Command();
  program
    .name(Object.keys(pkg.bin)[0] ?? "mcp-fs")
    .version(pkg.version)
    .description("MCP Secure Filesystem Server")
    .argument("<allowed-directories...>", "List of directories the server is allowed to access.")
    .action(async (dirs) => {
      try {
        await startServer(dirs);
      } catch (error) {
        console.error("Fatal error running server:", error);
        process.exit(1);
      }
    });

  await program.parseAsync(process.argv);
}

if (import_meta_ponyfill(import.meta).main) {
  main().catch((error) => {
    console.error("An unexpected error occurred:", error);
    process.exit(1);
  });
}
