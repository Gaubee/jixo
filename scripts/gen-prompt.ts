import {blue, createResolverByRootFile, cwdResolver, green} from "@gaubee/nodekit";
import {parseArgs} from "@std/cli/parse-args";
import {import_meta_ponyfill} from "import-meta-ponyfill";
import {readFileSync, watch, writeFileSync} from "node:fs";
import path from "node:path";
import {Signal} from "signal-polyfill";
import {effect} from "signal-utils/subtle/microtask-effect";
const rootResolver = createResolverByRootFile(import.meta.url);

const getFileState = (filepath: string, once: boolean) => {
  const fileState = new Signal.State(readFileSync(filepath, "utf-8"));
  if (!once) {
    const off = effect(() => {
      const watcher = watch(filepath, () => {
        try {
          fileState.set(readFileSync(filepath, "utf-8"));
        } catch {
          watcher.close();
          off();
        }
      });
    });
  }
  return fileState;
};

const gen_prompt = async (input: string, output: string, once: boolean) => {
  const inputContent = getFileState(input, once).get();
  const ouputContent = inputContent
    ///
    .replace(/@#([\w\.\-\/]+)/g, (_, filepath) => {
      try {
        return "`" + filepath + "`:\n````" + path.parse(filepath).ext.slice(1) + "\n" + getFileState(rootResolver(filepath), once).get() + "\n````";
      } catch (e) {
        return _;
      }
    });
  writeFileSync(output, ouputContent);
  console.log(blue(new Date().toLocaleTimeString()), green(`✅ ${path.parse(output).name} updated`));
};

if (import_meta_ponyfill(import.meta).main) {
  const args = parseArgs(process.argv.slice(2), {boolean: ["watch"]});
  if (args._.length === 0) {
    throw new Error("Please specify the input file");
  }
  const inputFile = cwdResolver(args._[0].toString());
  const outputFile = args._[1] ? cwdResolver(args._[1].toString()) : inputFile.replace(/\.md$/, ".gen.md");
  const once = !args.watch;
  const off = effect(() => {
    gen_prompt(inputFile, outputFile, once);
  });
  if (once) {
    off();
  }
}
