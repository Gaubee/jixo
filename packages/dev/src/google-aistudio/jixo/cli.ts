#!/usr/bin/env node
import {parseArgs} from "@std/cli/parse-args";
import {import_meta_ponyfill} from "import-meta-ponyfill";
import {doStart, doSync} from "./index.js";
import {startWsServer} from "./ws-server.js";

if (import_meta_ponyfill(import_meta_ponyfill(import.meta)).main) {
  const args = parseArgs(process.argv.slice(2), {
    string: ["outDir", "wsPort"],
    boolean: ["watch", "force"],
    alias: {
      O: "outDir",
      W: "watch",
      F: "force",
    },
    default: {
      wsPort: "8765",
    },
  });

  const command = args._[0];

  if (command === "start") {
    const workDir = args._[1]?.toString() || process.cwd();
    // Start command handles its own services
    doStart({workDir, force: args.force});
  } else {
    // Legacy support for direct sync command
    // Start the WebSocket server in the background
    void startWsServer(parseInt(args.wsPort, 10));
    // Run the main file synchronization logic
    doSync(args);
  }
}
