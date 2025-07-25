#!/usr/bin/env node
import {parseArgs} from "@std/cli/parse-args";
import {import_meta_ponyfill} from "import-meta-ponyfill";
import {doGenPrompts} from "../gen-prompt.js";

if (import_meta_ponyfill(import.meta).main) {
  const args = parseArgs(process.argv.slice(2), {
    string: ["outFile", "glob", "cwd"],
    boolean: ["watch"],
    alias: {
      O: "outFile",
      G: "glob",
      W: "watch",
    },
    default: {
      glob: "*.meta.md",
      watch: false,
    },
  });
  if (args._.length === 0) {
    throw new Error("Please specify the input file(s) or pattern(s).");
  }

  await doGenPrompts({
    ...args,
    inputs: args._.map(String),
  });
}
