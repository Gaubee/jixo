#!/usr/bin/env node
import {parseArgs} from "@std/cli/parse-args";
import {import_meta_ponyfill} from "import-meta-ponyfill";
import {doSync} from "./index.js";

if (import_meta_ponyfill(import.meta).main) {
  const args = parseArgs(process.argv.slice(2), {
    string: ["outDir"],
    boolean: ["watch"],
    alias: {
      O: "outDir",
      W: "watch",
    },
  });
  doSync(args);
}
