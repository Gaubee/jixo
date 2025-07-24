import {createResolverByRootFile, normalizeFilePath, readJson} from "@gaubee/nodekit";
import {func_remember, map_get_or_put_async} from "@gaubee/util";
import {globbySync, isDynamicPattern, type Options as GlobbyOptions} from "globby";
import fs from "node:fs";
import path from "node:path";
import {match, P} from "ts-pattern";
import {getFileState} from "../../reactive-fs/reactive-fs.js";
import {generateFileTree} from "../file-tree.js";
import type {Replacer} from "./types.js";

const fetchCache = new Map<string, {res: Response; text: string}>();
const projectResolver = createResolverByRootFile(import.meta.url, "../../../../package.json");
const GET_JIXO_PROMPT = func_remember(() => readJson<Record<string, string>>(projectResolver("./assets/prompt.json")));

/**
 * A utility function to format the file content output in a standardized way.
 * It handles markdown code blocks and optional prefixes.
 */
function useFileOrInject(mode: string, filepath: string, filecontent: string, opts: {lang?: unknown; prefix?: unknown} = {}): string {
  const lines: Array<string[] | string> = [];
  const prefixStr = match(opts.prefix)
    .with(P.number, (len) => " ".repeat(len))
    .with(P.string, (str) => str)
    .otherwise(() => "");

  const contentLines = prefixStr.length ? filecontent.split("\n").map((line) => prefixStr + line) : [filecontent];

  if (mode === "FILE") {
    const split = filecontent.includes("```") ? "````" : "```";
    const ext = path.parse(filepath).ext.slice(1);
    lines.push(
      `${prefixStr}\`${filepath}\``,
      "",
      prefixStr +
        split +
        match(opts.lang)
          .with(P.string, (v) => v)
          .otherwise(() => ext),
      ...contentLines,
      prefixStr + split,
      "",
    );
  } else if (mode === "INJECT") {
    lines.push(...contentLines);
  } else {
    lines.push(`<!-- unknown mode ${mode} -->`);
  }
  return lines.join("\n");
}

/**
 * Handles replacements for file-based sources like local file system, URLs, and internal jixo protocol.
 */
export const handleFileReplacement: Replacer = async ({globOrFilepath, params, once, rootResolver, baseDir}) => {
  const normalizedMode = (params.mode as string).toUpperCase().replaceAll("-", "_").trim();

  // Handle internal-symbol like `jixo:system/prompt.md`
  if (globOrFilepath.startsWith("jixo:")) {
    const jixo_url = new URL(globOrFilepath);
    const filepath = (jixo_url.pathname || jixo_url.hostname).replace(/^\//, "");
    const content = (await GET_JIXO_PROMPT())[filepath];
    if (content) {
      return useFileOrInject(normalizedMode, `${filepath}.md`, content, {
        prefix: params.prefix,
        lang: params.lang,
      });
    }
    return `<!-- unknown jixo content ${filepath} -->`;
  }

  // Handle web-url
  if (/^https?:\/\//.test(globOrFilepath)) {
    const url = new URL(globOrFilepath);
    const urlRes = await map_get_or_put_async(fetchCache, url.href, async () => {
      const res = await fetch(url);
      const text = await res.text();
      return {res, text};
    });
    return useFileOrInject(normalizedMode, urlRes.res.url, urlRes.text, {
      prefix: params.prefix,
      lang: params[`mime_${urlRes.res.headers.get("content-type")?.split(";")}_lang`] ?? params.lang,
    });
  }

  // Handle local file system paths
  const isGlob = isDynamicPattern(globOrFilepath);
  const isInsideBaseDir = (targetPath: string) => normalizeFilePath(path.resolve(baseDir, targetPath)).startsWith(normalizeFilePath(baseDir) + "/");
  const isOutBaseDirFile = !isGlob && !isInsideBaseDir(globOrFilepath);

  const files = isOutBaseDirFile
    ? [globOrFilepath]
    : globbySync(
        globOrFilepath,
        match(params)
          .returnType<GlobbyOptions>()
          .with({cwd: P.string}, (p) => ({...p, absolute: false}))
          .otherwise(() => ({cwd: baseDir, absolute: false})),
      );

  if (files.length === 0) {
    return `<!-- No files found for pattern: ${globOrFilepath} -->`;
  }

  const lines: string[] = [];
  if (normalizedMode === "FILE_TREE") {
    const expandDirectories = params.expandDirectories !== false;
    lines.push("\n```\n", generateFileTree(files, expandDirectories), "\n```\n");
  } else {
    for (const filepath of files) {
      const fullFilepath = rootResolver(filepath);
      if (!fs.statSync(fullFilepath).isFile()) {
        continue;
      }
      const fileContent = getFileState(fullFilepath, once).get();
      const ext = path.parse(filepath).ext.slice(1);

      lines.push(
        useFileOrInject(normalizedMode, filepath, fileContent, {
          prefix: params.prefix,
          lang: params[`map_ext_${ext}_lang`] ?? params.lang,
        }),
      );
    }
  }

  return lines.join("\n");
};
