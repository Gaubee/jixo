import {$, createResolverByRootFile} from "@gaubee/nodekit";
import {parseArgs} from "@std/cli/parse-args";
import {globbySync} from "globby";
const rootResolver = createResolverByRootFile(import.meta.url);
const args = parseArgs(process.argv.slice(2), {
  collect: ["filter"],
  alias: {
    F: "filter",
  },
});

$.cd(rootResolver.dirname);

const testFiles = args._.length ? args._ : globbySync("dist/test/**/*.test.js", {cwd: $.cwd});

const patternArgs: string[] = [];
args.filter?.forEach((f) => {
  const pattern = String(f);
  if (pattern.startsWith("!")) {
    patternArgs.push(`--test-skip-pattern=${JSON.stringify(pattern.slice(1))}`);
  } else {
    patternArgs.push(`--test-name-pattern=${JSON.stringify(pattern)}`);
  }
});

await $`node --experimental-test-coverage --enable-source-maps --test --test-concurrency ${patternArgs} ${testFiles}`;
