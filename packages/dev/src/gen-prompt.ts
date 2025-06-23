process.removeAllListeners("warning");

import {blue, createResolverByRootFile, cwdResolver, green, normalizeFilePath} from "@gaubee/nodekit";
import parcelWatcher from "@parcel/watcher";
import {parseArgs} from "@std/cli/parse-args";
import {globbySync} from "globby";
import {import_meta_ponyfill} from "import-meta-ponyfill";
import {readFileSync, statSync, watch, writeFileSync} from "node:fs";
import path from "node:path";
import {Signal} from "signal-polyfill";
import {effect} from "signal-utils/subtle/microtask-effect";

const rootResolver = createResolverByRootFile(process.cwd());

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

const dirGLobState = (dirname: string, glob: string, once: boolean) => {
  const dirState = new Signal.State(globbySync(glob, {cwd: dirname}), {
    equals(t, t2) {
      return t.length === t2.length && t.every((file, i) => file === t2[i]);
    },
  });
  if (!once) {
    const off = effect(async () => {
      const sub = await parcelWatcher.subscribe(dirname, (err, events) => {
        if (events.some((event) => event.type === "create" || event.type === "delete")) {
          try {
            dirState.set(globbySync(glob, {cwd: dirname}));
          } catch {
            sub.unsubscribe();
            off();
          }
        }
      });
    });
  }
  return dirState;
};

const gen_prompt = async (input: string, once: boolean, _output?: string) => {
  console.log(blue("gen_prompt"), input);
  const output = _output ? cwdResolver(_output) : input.replace(/\.md$/, ".gen.md");
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
        const fullFilepath = rootResolver(filepath);
        if (!statSync(fullFilepath).isFile()) {
          continue;
        }
        const fileContent = getFileState(fullFilepath, once).get();
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

const gen_prompts = (dirname: string, once: boolean, glob = "*.meta.md") => {
  console.log(blue("gen_prompts"), dirname, glob);
  for (const filename of dirGLobState(dirname, glob, once).get()) {
    gen_prompt(path.join(dirname, filename), once);
  }
};

if (import_meta_ponyfill(import.meta).main) {
  const args = parseArgs(process.argv.slice(2), {
    string: ["outFile", "glob"],
    boolean: ["watch"],
    alias: {
      O: "outFile",
      G: "glob",
      W: "watch",
    },
  });
  if (args._.length === 0) {
    throw new Error("Please specify the input file");
  }
  let input = normalizeFilePath(cwdResolver(args._[0].toString()));
  if (input.includes("*")) {
    const parts = input.split("/");
    const index = parts.findIndex((part) => part.includes("*"));
    const dir = parts.slice(0, index).join("/") || "/";
    const glob = parts.slice(index).join("/");
    input = dir;
    args.glob = glob;
  }
  const once = !args.watch;
  const inputStat = statSync(input);
  if (inputStat.isFile()) {
    const off = effect(() => {
      gen_prompt(input, once, args.outFile);
    });
    if (once) {
      off();
    }
  } else {
    const off = effect(() => {
      gen_prompts(input, once, args.glob);
    });
    if (once) {
      off();
    }
  }
}
