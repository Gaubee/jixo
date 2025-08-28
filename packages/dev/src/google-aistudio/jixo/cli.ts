#!/usr/bin/env node
import {parseArgs} from "@std/cli/parse-args";
import {import_meta_ponyfill} from "import-meta-ponyfill";
import {doSync} from "./index.js";
import {startWsServer} from "./ws-server.js";

if (import_meta_ponyfill(import.meta).main) {
  const args = parseArgs(process.argv.slice(2), {
    string: ["outDir", "wsPort"],
    boolean: ["watch"],
    alias: {
      O: "outDir",
      W: "watch",
    },
    default: {
      wsPort: "8765",
    },
  });

  // Start the WebSocket server. It will run in the background.
  startWsServer(parseInt(args.wsPort, 10));

  // Run the main file synchronization logic
  doSync(args);
}
