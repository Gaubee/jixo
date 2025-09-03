#!/usr/bin/env node
import {parseArgs} from "@std/cli/parse-args";
import {import_meta_ponyfill} from "import-meta-ponyfill";
import {doStart} from "./start.js";
import {doSync} from "./sync.js";
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
  const remainingArgs = process.argv.slice(3);

  switch (command) {
    case "start": {
      const workDir = args._[1]?.toString() || process.cwd();
      doStart({workDir, force: args.force});
      break;
    }
    default: {
      // Legacy support for direct sync command
      void startWsServer(parseInt(args.wsPort, 10));
      doSync(args);
      break;
    }
  }
}
