import {readJson} from "@gaubee/nodekit";
import {func_remember} from "@gaubee/util";
import {match, P} from "ts-pattern";
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
  if (specifier === "memory") {
    const {handleFileReplacement} = await import("./file-replacer.js");
    const memoryOptions = {
      ...options,
      globOrFilepath: `.jixo/memory/${options.codeName}/*.md`,
      mode: match(options.params.mode)
        .with(P.string, (v) => v)
        .otherwise(() => options.mode),
    };

    return handleFileReplacement(memoryOptions);
  }
  if (specifier === "datetime") {
    return new Date().toLocaleString();
  }

  /// 通用的文件读取方式
  if (specifier === "system") {
    specifier = "coder";
  }
  let content = (await GET_JIXO_PROMPT())[specifier];

  if (specifier.includes("_json")) {
    /// 如果是JSON文件，那么序列化后再输出
    content = JSON.stringify(content, null, z.int().optional().safeParse(options.params.spaces).data ?? 2);
  } else {
    /// 如果不是JSON文件，那么走md标准做一次输出
    const {_gen_content} = await import("../../gen-prompt.js");
    content = await _gen_content(options.codeName, content, options.rootResolver);
  }

  return content;
};
