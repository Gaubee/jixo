process.removeAllListeners("warning");

import {blue, createResolver, createResolverByRootFile, green, matter, normalizeFilePath, type PathResolver} from "@gaubee/nodekit";
import {defaultParseSearch} from "@tanstack/router-core";
import Debug from "debug";
import {globbySync, isDynamicPattern} from "globby";
import fs, {mkdirSync, writeFileSync} from "node:fs";
import path from "node:path";
import {effect} from "signal-utils/subtle/microtask-effect";
import {match, P} from "ts-pattern";
import {handleFileReplacement} from "./gen-prompt/replacers/file-replacer.js";
import {handleGitReplacement} from "./gen-prompt/replacers/git-replacer.js";
import type {ReplacerOptions} from "./gen-prompt/replacers/types.js";
import {dirGlobState, getFileState} from "./reactive-fs/reactive-fs.js";
import {removeMarkdownComments} from "./utils/markdown-remove-comment.js";

export const debug = Debug("gen-prompt");

async function processReplacement(
  globOrFilepath: string,
  mode: string,
  paramString: string | undefined,
  once: boolean,
  rootResolver: PathResolver,
  baseDir: string,
): Promise<string> {
  if (globOrFilepath.startsWith("`") && globOrFilepath.endsWith("`")) {
    globOrFilepath = globOrFilepath.replace(/^`+(.*)`+$/, "$1");
  }
  globOrFilepath = normalizeFilePath(globOrFilepath);

  const normalizedMode = mode.toUpperCase().replaceAll("-", "_").trim();

  const params = defaultParseSearch(paramString || "");

  const options: ReplacerOptions = {globOrFilepath, mode: normalizedMode, params, once, rootResolver, baseDir};

  debug("Dispatching replacement for:", {globOrFilepath, mode: normalizedMode, params});

  // Dispatch to the appropriate replacer based on the mode prefix.
  if (mode.startsWith("GIT")) {
    return handleGitReplacement(options);
  }

  // Default to file replacer for FILE, FILE_TREE, INJECT, etc.
  return handleFileReplacement(options);
}

export async function gen_prompt(input: string, once: boolean, _output?: string, cwd?: string) {
  console.log(blue("gen_prompt"), input);

  const inputSource = getFileState(input, once).get();
  let {data: inputData, content: inputContent} = matter(inputSource);
  inputContent = removeMarkdownComments(inputContent).trim();

  const currentRootResolver = match(cwd)
    .with(P.string, (c) => createResolver(c))
    .otherwise(() =>
      match(inputData.cwd as string | undefined)
        .with(
          P.when((p) => p && path.isAbsolute(p)),
          (p) => createResolver(p!),
        )
        .with(P.string, (p) => createResolver(path.resolve(path.dirname(input), p!)))
        .otherwise(() => createResolverByRootFile(input, ".git", () => path.dirname(input))),
    );

  const output = currentRootResolver(
    _output ??
      match(inputData.output as string | undefined)
        .with(P.string, (v) => v)
        .otherwise(() => input.replace(/\.md$/, ".gen.md")),
  );

  const regex = /\[(.+?)\]\(@([\w-_:]+)(\?.+)?\)/g;
  const matches = [...inputContent.matchAll(regex)];

  const replacementPromises = matches.map((match) => {
    const [_, globOrFilepath, mode, paramString] = match;
    return processReplacement(globOrFilepath, mode, paramString, once, currentRootResolver, currentRootResolver.dirname);
  });

  const replacements = await Promise.all(replacementPromises);

  let outputContent = inputContent;
  for (let i = matches.length - 1; i >= 0; i--) {
    const match = matches[i];
    const replacement = replacements[i];
    if (match.index !== undefined) {
      outputContent = outputContent.substring(0, match.index) + replacement + outputContent.substring(match.index + match[0].length);
    }
  }

  mkdirSync(path.dirname(output), {recursive: true});
  writeFileSync(output, outputContent);
  console.log(blue(new Date().toLocaleTimeString()), green(`✅ ${path.parse(output).name} updated`));
}

export interface GenOptions {
  inputs: string[];
  outFile?: string;
  watch: boolean;
  cwd?: string;
  glob: string;
}

export const doGenPrompts = async (argv: GenOptions) => {
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
};
