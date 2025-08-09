import {readJson} from "@gaubee/nodekit";
import {func_remember} from "@gaubee/util";
import z from "zod";
import {assetsResolver} from "../../utils/resolver.js";
import type {ReplacerOptions} from "./types.js";
const GET_JIXO_PROMPT = func_remember(() => readJson<Record<string, any>>(assetsResolver("prompt.json")));

export const jixoProvider = async (specifier: string, options: ReplacerOptions) => {
  specifier = specifier.toLowerCase();
  /// 一些特殊的代号
  if (specifier === "pwd") {
    return options.baseDir;
  }
  if (specifier === "code_name") {
    return options.codeName;
  }
  if (specifier === "datetime") {
    return new Date().toLocaleString();
  }
  if (specifier === "memory") {
    const {localFileReplacement} = await import("./file-replacer.js");
    const memoryOptions = {
      ...options,
      globOrFilepath: `.jixo/memory/${options.codeName}/*.md`,
      params: {gitignore: false, ...options.params},
    };

    return localFileReplacement(memoryOptions);
  }

  /// 通用的文件读取方式
  if (specifier === "system") {
    specifier = "coder";
  }
  let content = (await GET_JIXO_PROMPT())[specifier];

  if (specifier.includes(".json")) {
    /// 如果是JSON文件，那么序列化后再输出
    content = JSON.stringify(content, null, z.int().optional().safeParse(options.params.spaces).data ?? 2);
  } else {
    /// 如果不是JSON文件，那么走md标准做一次输出
    const {_gen_content} = await import("../../gen-prompt.js");
    content = await _gen_content(options.codeName, content, options.rootResolver);
  }

  if (content) {
    const {useFileOrInject} = await import("./file-replacer.js");
    return useFileOrInject(options.mode, `${specifier}.md`, content, options.params);
  }
  return `<!-- unknown jixo content ${specifier} -->`;
};
