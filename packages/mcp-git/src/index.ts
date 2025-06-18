import {Command} from "commander";
import {import_meta_ponyfill} from "import-meta-ponyfill";
import pkg from "../package.json" with {type: "json"};
import {startServer} from "./server.js";

async function main() {
  const program = new Command();

  program
    .name(Object.keys(pkg.bin)[0])
    .version(pkg.version)
    .description("MCP Git Server - Git functionality for MCP")
    .option("-r, --repository <path>", "Git repository path")
    .option("-v, --verbose", "Enable verbose logging", (_, previous) => previous + 1, 0)
    .action(async (options) => {
      // Verbose logging level can be implemented here if needed
      // For now, we just pass the repository path to the server
      try {
        await startServer(options.repository);
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
