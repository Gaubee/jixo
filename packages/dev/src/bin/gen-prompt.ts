#!/usr/bin/env node
import {parseArgs} from "@std/cli/parse-args";
import {globbySync, isDynamicPattern} from "globby";
import {import_meta_ponyfill} from "import-meta-ponyfill";
import fs from "node:fs";
import path from "node:path";
import {effect} from "signal-utils/subtle/microtask-effect";
import {gen_prompt} from "../gen-prompt.js";
import {dirGlobState} from "../reactive-fs/reactive-fs.js";

async function run(argv: {inputs: string[]; outFile?: string; watch: boolean; cwd?: string; glob: string}) {
  const once = !argv.watch;
  const CWD = argv.cwd || process.cwd();

  for (const input of argv.inputs) {
    const resolvedInput = path.resolve(CWD, input);

    if (isDynamicPattern(input)) {
      const files = globbySync(input, {cwd: CWD});
      console.log(`Glob pattern '${input}' matched ${files.length} files.`);
      for (const file of files) {
        await gen_prompt(file, once, undefined, CWD);
      }
    } else if (fs.existsSync(resolvedInput)) {
      const stat = fs.statSync(resolvedInput);
      if (stat.isFile()) {
        const off = effect(() => {
          gen_prompt(resolvedInput, once, argv.outFile, CWD);
        });
        if (once) off();
      } else if (stat.isDirectory()) {
        console.log(`Processing directory '${input}' with glob '${argv.glob}'...`);
        const off = effect(() => {
          for (const filename of dirGlobState(resolvedInput, argv.glob, once).get()) {
            gen_prompt(path.join(resolvedInput, filename), once, undefined, CWD);
          }
        });
        if (once) off();
      }
    } else {
      console.warn(`Warning: Input path does not exist, but treating as a potential glob: ${input}`);
      const files = globbySync(input, {cwd: CWD});
      if (files.length > 0) {
        for (const file of files) {
          await gen_prompt(file, once, undefined, CWD);
        }
      } else {
        console.error(`Error: Input '${input}' not found and did not match any files.`);
      }
    }
  }

  if (argv.watch) {
    console.log("\nWatching for file changes... Press Ctrl+C to exit.");
  }
}

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

  await run({
    ...args,
    inputs: args._.map(String),
  });
}
