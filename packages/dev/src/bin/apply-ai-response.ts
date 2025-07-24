#!/usr/bin/env node
import {parseArgs} from "@std/cli/parse-args";
import {import_meta_ponyfill} from "import-meta-ponyfill";
import {doApplyAiResponse} from "../apply-ai-response.js";

// This file serves as the command-line interface for the apply-ai-response functionality.
if (import_meta_ponyfill(import.meta).main) {
  const args = parseArgs(process.argv.slice(2), {
    boolean: ["format", "yes", "gitCommit", "unsafe"],
    string: ["cwd"],
    alias: {
      G: "gitCommit",
      F: "format",
      Y: "yes",
      C: "cwd",
    },
    default: {
      format: true,
      yes: false,
      gitCommit: false,
      unsafe: false,
    },
  });

  const files = args._.map((v) => v.toString());

  if (files.length === 0) {
    console.error("Error: Please provide at least one markdown file path or glob pattern.");
    process.exit(1);
  }

  await doApplyAiResponse(files, args);
}
