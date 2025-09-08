import {normalizeFilePath} from "@gaubee/nodekit";
import {map_get_or_put_async} from "@gaubee/util";
import {defaultParseSearch} from "@tanstack/router-core";
import {globbySync, isDynamicPattern} from "globby";
import fs from "node:fs";
import path from "node:path";
import {match, P} from "ts-pattern";
import {reactiveFs} from "../../reactive-fs/reactive-fs.js";
import {generateFileTree} from "../file-tree.js";
import {jixoProvider} from "./jixo-provider.js";
import {paramsToGlobbyOptions} from "./params-to-globby-options.js";
import type {Replacer} from "./types.js";

const fetchCache = new Map<string, {res: Response; text: string}>();
const tryStr = (value: unknown) => {
  if (typeof value === "string") {
    return value;
  }
};

/**
 * A utility function to format the file content output in a standardized way.
 * It handles markdown code blocks and optional prefixes.
 */
export function useFileOrInject(
  mode: string,
  filepath: string,
  filecontent: string,
  opts: {
    ext?: unknown;
    lang?: unknown;

    prefix?: unknown;
    filepath?: unknown;
  } = {},
): string {
  const lines: Array<string[] | string> = [];
  const prefixStr = match(opts.prefix)
    .with(P.number, (len) => " ".repeat(len))
    .with(P.string, (str) => str)
    .otherwise(() => "");

  const contentLines = prefixStr.length ? filecontent.split("\n").map((line) => prefixStr + line) : [filecontent];

  filepath = tryStr(opts.filepath) ?? filepath;

  if (mode === "FILE") {
    const split = filecontent.includes("```") ? "````" : "```";
    const ext = path.parse(filepath).ext.slice(1);
    if (filepath.length) {
      lines.push(`${prefixStr}\`${filepath}\``, "");
    }
    const lang = tryStr(opts.ext ?? opts.lang) ?? ext;
    lines.push(
      //
      `${prefixStr}${split}${lang}`,
      ...contentLines,
      `${prefixStr}${split}`,
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
 * Core logic for globbing files with query-like parameters.
 * This is the unified engine for both gen-prompt and frontend previews.
 * @param patternWithParams - A single pattern string, e.g., "src?ignore=*.test.ts"
 * @param baseDir - The current working directory.
 * @returns An array of matched file paths.
 */
export function globFilesWithParams(patternWithParams: string, baseDir: string, _params: Record<string, any> = {}): string[] {
  const [globOrFilepath, paramString] = patternWithParams.split("?");
  const params = {
    ...defaultParseSearch(paramString || ""),
    ..._params,
  };
  const isGlob = isDynamicPattern(globOrFilepath);

  const isInsideBaseDir = (targetPath: string) => normalizeFilePath(path.resolve(baseDir, targetPath)).startsWith(normalizeFilePath(baseDir) + "/");
  const isOutBaseDirFile = !isDynamicPattern(globOrFilepath) && !isInsideBaseDir(globOrFilepath);

  const files = isOutBaseDirFile
    ? [globOrFilepath]
    : globbySync(
        globOrFilepath,
        paramsToGlobbyOptions(params, {
          gitignore: isGlob ? true : false,
          cwd: baseDir,
        }),
      ).map((entry) => (typeof entry === "string" ? entry : entry.path));

  return files;
}

/**
 * Handles replacements for file-based sources like local file system, URLs, and internal jixo protocol.
 */
export const handleFileReplacement: Replacer = async (options) => {
  const {globOrFilepath, mode, params, rootResolver, baseDir} = options;
  // Handle internal-symbol like `jixo:coder`
  if (globOrFilepath.toLocaleLowerCase().startsWith("jixo:")) {
    const jixo_uri = new URL(globOrFilepath);
    const specifier = (jixo_uri.pathname || jixo_uri.hostname).replace(/^\//, "");
    return await jixoProvider(specifier, options);
  }

  // Handle web-url
  if (/^https?:\/\//.test(globOrFilepath)) {
    const url = new URL(globOrFilepath);
    const urlRes = await map_get_or_put_async(fetchCache, url.href, async () => {
      const res = await fetch(url);
      const text = await res.text();
      return {res, text};
    });
    return useFileOrInject(mode, urlRes.res.url, urlRes.text, {
      ...params,
      lang: params[`mime_${urlRes.res.headers.get("content-type")?.split(";")}_lang`] ?? params.lang,
    });
  }

  // Handle local file system paths
  return await localFileReplacement(options);
};

/**
 * local file system paths
 * @param options
 * @returns
 */
export const localFileReplacement: Replacer = async (options) => {
  const {globOrFilepath, mode, params, rootResolver, baseDir} = options;

  const files = globFilesWithParams(globOrFilepath, baseDir, params);

  if (files.length === 0) {
    const errorMsg = `No files found for pattern: ${globOrFilepath}`;

    return (
      tryStr(params.noFound) ??
      //
      `${tryStr(params["noFound.prefix"]) ?? "<!-- "}${tryStr(params["noFound.msg"]) ?? errorMsg}${tryStr(params["noFound.suffix"]) ?? " -->"}`
    );
  }

  const lines: string[] = [];
  if (mode === "FILE_TREE") {
    const expandDirectories = params.expandDirectories !== false;

    lines.push(useFileOrInject("FILE", "", generateFileTree(files, expandDirectories), params));
  } else if (mode === "FILE_LIST") {
    debugger;
    lines.push(useFileOrInject("INJECT", "", files.join("\n"), params));
  } else {
    for (const filepath of files) {
      const fullFilepath = rootResolver(filepath);
      if (!fs.statSync(fullFilepath).isFile()) {
        continue;
      }
      const fileContent = reactiveFs.readFile(fullFilepath);
      const ext = path.parse(filepath).ext.slice(1);

      lines.push(
        useFileOrInject(mode, filepath, fileContent, {
          ...params,
          lang: params[`map_ext_${ext}_lang`] ?? params.lang,
        }),
      );
    }
  }

  return lines.join("\n");
};
