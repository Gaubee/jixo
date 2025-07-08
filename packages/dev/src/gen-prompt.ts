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
      if (mode === "GIT-DIFF" || mode === "GIT-FILES") {
        /**
         * @TODO 使用 simple-git 这个库来实现以下的功能：
         *
         * 这里的格式是：
         * 1. [`./glob_or_filepath`](@GIT-DIFF)
         *    > glob_or_filepath这个路径下，有变更的文件，使用diff格式展示变更内容
         * 1. [`gitcommithash:./glob_or_filepath`](@GIT-DIFF)
         *    > 在gitcommithash这次提交中，glob_or_filepath这个路径下，有变更的文件，使用diff格式展示变更内容
         * 1. [`./glob_or_filepath`](@GIT-FILES)
         *    > glob_or_filepath这个路径下，有变更的文件，直接输出整个文件内容
         * 1. [`gitcommithash:./glob_or_filepath`](@GIT-FILES)
         *    > 在gitcommithash这次提交中，glob_or_filepath这个路径下，有变更的文件，直接输出整个文件内容
         *
         * 首先区分 GIT-DIFF 和 GIT-FILES 的产出内容：
         * 1. git-diff 顾名思义，就是插入 '```diff ... ```' 这样的内容。
         * 2. 而 git-files 就是直接插入文件。同下文的FILE模式
         *
         * 然后说一下这里的 glob_or_filepath 的作用：
         * 1. 如果有 gitcommithash，那么就是找到指定的hash的commit，然后取出它的变更文件列表。
         * 2. 如果没有 gitcommithash，那么就是指当前的未提交的文件。
         */
      }

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
