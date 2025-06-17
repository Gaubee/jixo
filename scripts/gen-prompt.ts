import {blue, createResolverByRootFile, cwdResolver, green, normalizeFilePath} from "@gaubee/nodekit";
import {parseArgs} from "@std/cli/parse-args";
import {globbySync} from "globby";
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
  const outputContent = inputContent
    ///
    .replace(/\[(.+?)\]\(@(\w+)\)/g, (_, glob_or_filepath, mode) => {
      if (glob_or_filepath.startsWith("`")) {
        glob_or_filepath = glob_or_filepath.slice(1, -1);
      }
      glob_or_filepath = normalizeFilePath(glob_or_filepath);
      mode = mode.toUpperCase().trim();
      console.log(blue("glob_or_filepath"), green(mode), glob_or_filepath);
      const files = globbySync(glob_or_filepath);
      if (files.length === 0) {
        return _;
      }
      const lines: string[] = [];
      for (const filepath of globbySync(glob_or_filepath)) {
        const fileContent = getFileState(rootResolver(filepath), once).get();
        if (mode === "FILE") {
          // const split = "````"; //fileContent.includes("```") ? "````" : "```";
          // lines.push(
          //   //
          //   `<FILE path="${filepath}">`,
          //   "<CONTENT>",
          //   split + path.parse(filepath).ext.slice(1),
          //   fileContent,
          //   split,
          //   "</CONTENT>",
          //   "</FILE>\n",
          // );
          const split = fileContent.includes("```") ? "````" : "```";
          lines.push(
            //
            "",
            filepath,
            split + path.parse(filepath).ext.slice(1),
            fileContent,
            split,
            "",
          );
        } else if (mode === "INJECT") {
          lines.push(fileContent);
        } else {
          lines.push(`<!-- unknown mode ${mode} -->`);
        }
      }
      return lines.join("\n");
    });

  writeFileSync(output, outputContent);
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
