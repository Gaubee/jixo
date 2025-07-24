process.removeAllListeners("warning");

import {blue, createResolver, createResolverByRootFile, green, matter, normalizeFilePath, type PathResolver} from "@gaubee/nodekit";
import {defaultParseSearch} from "@tanstack/router-core";
import Debug from "debug";
import {mkdirSync, writeFileSync} from "node:fs";
import path from "node:path";
import {match, P} from "ts-pattern";
import {handleFileReplacement} from "./gen-prompt/replacers/file-replacer.js";
import {handleGitReplacement} from "./gen-prompt/replacers/git-replacer.js";
import {getFileState} from "./reactive-fs/reactive-fs.js";
import {removeMarkdownComments} from "./utils/markdown-remove-comment.js";

export const debug = Debug("gen-prompt");

async function processReplacement(
  fullMatch: string,
  globOrFilepath: string,
  mode: string,
  paramString: string | undefined,
  once: boolean,
  rootResolver: PathResolver,
  baseDir: string,
): Promise<string> {
  if (globOrFilepath.startsWith("`")) {
    globOrFilepath = globOrFilepath.slice(1, -1);
  }
  globOrFilepath = normalizeFilePath(globOrFilepath);

  const params = {
    ...defaultParseSearch(paramString || ""),
    mode,
  };

  debug("Dispatching replacement for:", {globOrFilepath, mode, params});

  const options = {globOrFilepath, params, once, rootResolver, baseDir};

  // Dispatch to the appropriate replacer based on the mode prefix.
  if (mode.toUpperCase().startsWith("GIT")) {
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
    const [fullMatch, globOrFilepath, mode, paramString] = match;
    return processReplacement(fullMatch, globOrFilepath, mode, paramString, once, currentRootResolver, currentRootResolver.dirname);
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
  // This function is now intended to be the primary entry point for CLI tools.
  // The logic has been moved to the bin file to keep this module as a library.
  // We keep the export for API compatibility.
  console.log("`doGenPrompts` is now primarily handled by its bin entry. Use the CLI or the bin script.");
};
