import {iter_map_not_null, obj_props} from "@gaubee/util";
import {parseArgs} from "@std/cli/parse-args";
import clipboard from "clipboardy";
import {import_meta_ponyfill} from "import-meta-ponyfill";
import JSON5 from "json5";
import {mkdir, readFile, writeFile} from "node:fs/promises";
import path from "node:path";
import {match} from "ts-pattern";
import {z} from "zod";

export interface SyncAiResponsesOptions {
  /** 输出文件夹
   * @default '$CWD/.ai'
   */
  outDir?: string;
  /**
   * 输入来源
   * @enum {'clipboard', 'file'}
   * @default 'clipboard'
   */
  input?: string;
  /**
   * 数据源
   * 决定了数据处理的规范
   * @enum {'aistudio.google','chat.qwen'}
   */
  from?: string;
  /**
   * 输出风格
   * @enum {'jixo:system','none'}
   */
  style?: string;
  /**
   * 是否启用监听
   */
  watch?: boolean;
}
const zInput = z.enum(["clipboard", "file",]).optional().default("clipboard");
const zFrom = z.enum(["aistudio.google", "chat.qwen"]).optional().default("aistudio.google");
const zStyle = z.enum(["jixo:system", "none"]).optional().default("jixo:system");

export const syncAiResponses = async ({outDir, input, from, style}: SyncAiResponsesOptions, argv: string[]) => {
  const safeOutDir = path.resolve(process.cwd(), outDir ?? ".ai");
  const safeInput = zInput.safeParse(input).data ?? zInput.parse(void 0);
  const safeFrom = zFrom.safeParse(from).data ?? zFrom.parse(void 0);
  const safeStyle = zStyle.safeParse(style).data ?? zStyle.parse(void 0);

  const unknownData = await match(safeInput)
    .with("clipboard", () => clipboard.read())
    .with("file", () => readFile(argv[0] as string, "utf-8"))
    .exhaustive();

  const modelHistory: string[] = match(safeFrom)
    .with("aistudio.google", () => {
      for (const key of obj_props(googleAistudioParser)) {
        const modelHistory = googleAistudioParser[key](unknownData);
        if (modelHistory) {
          return modelHistory;
        }
      }
      throw new Error("no support data format.");
    })
    .with("chat.qwen", () => {
      throw new Error("no implement yet.");
    })
    .exhaustive();
  if (!modelHistory?.length) {
    return;
  }
  const name_len = Math.floor(Math.log10(modelHistory.length)) + 1;

  const files: Array<{
    name: string;
    content: string;
  }> = match(safeStyle)
    .with("none", () => {
      return modelHistory.map((data, index) => {
        return {name: `${index}`.padStart(name_len, "0") + ".md", content: data};
      });
    })
    .with("jixo:system", () => {
      let first_index = 0;
      let second_index = -1;
      return modelHistory.map((content) => {
        if (content.includes("【变更日志】")) {
          first_index += 1;
          second_index = 0;
        } else {
          second_index += 1;
        }
        const name = `${first_index}`.padStart(name_len, "0") + "-" + `${second_index}`.padStart(name_len, "0") + ".md";
        return {name, content};
      });
    })
    .exhaustive();

  await mkdir(safeOutDir, {recursive: true});
  for (const file of files) {
    await writeFile(path.join(safeOutDir, file.name), file.content);
  }
};

/**
 * 正则工具函数：
 * ```js
 * function toReg(code) {
 *   return code
 *     .replaceAll("[", "\\[")
 *     .replaceAll("]", "\\]")
 *     .replaceAll("{", "\\{")
 *     .replaceAll("}", "\\}")
 *     .replaceAll("\n", "\\n")
 *     .replaceAll(/\s+/g, (s) => (s.length === 1 ? "\\s" : `\\s{${s.length}}`));
 * }
 * ```
 */
const googleAistudioParser = {
  REST: (data: string) => {
    if (!data.startsWith("#!/bin/bash")) {
      return;
    }
    console.log("maybe REST");
    const START_CODE = `cat << EOF > request.json`;
    const END_CODE = `EOF`;
    const start_index = data.indexOf(START_CODE) + START_CODE.length;
    const end_index = data.lastIndexOf(END_CODE);
    const jsonData = JSON5.parse(data.slice(start_index, end_index));

    const safeJsonData = z
      .object({
        contents: z.array(
          z.object({
            role: z.string(),
            parts: z.array(z.object({text: z.string()})),
          }),
        ),
      })
      .parse(jsonData);

    return iter_map_not_null(safeJsonData.contents, (c) => {
      if (c.role === "model") {
        return c.parts.at(-1)?.text || null;
      }
    });
  },
  Python: (data: string) => {
    if (!data.startsWith("# To run this code you need to install the following dependencies:")) {
      return;
    }
    console.log("maybe Python");
    const reg = /\s{8}types.Content\(\n\s{12}role="(\w+)",\n\s{12}parts=\[\n\s{16}types\.Part\.from_text\(text="""([\w\W]*?)"""\),\n\s{12}],\n\s{8}\),/g;
    const matchs = data.matchAll(reg).toArray();
    if (matchs.length === 0) {
      return;
    }
    return iter_map_not_null(matchs, (m) => {
      if (m[1] === "model") {
        return m[2]
          .split(
            `"""),
                types.Part.from_text(text="""`,
          )
          .at(-1)
          ?.replaceAll("\\\\", "\\")
          .replaceAll('\\"', '"');
      }
    });
  },
  TypeScript: (data: string) => {
    if (!data.startsWith("// To run this code you need to install the following dependencies:")) {
      return;
    }
    console.log("maybe TypeScript");
    const reg = /\s{4}\{\n\s{6}role:\s'(\w+)',\n\s{6}parts:\s\[\n\s{8}{\n\s{10}text:\s`([\w\W]*?)`,\n\s{8}\},\n\s{6}\],\n\s{4}\},/g;
    const matchs = data.matchAll(reg).toArray();
    if (matchs.length === 0) {
      return;
    }
    return iter_map_not_null(matchs, (m) => {
      if (m[1] === "model") {
        return m[2]
          .split(
            `\`,
        },
        {
          text: \``,
          )
          .at(-1)
          ?.replaceAll("\\\\", "\\")
          .replaceAll("\\`", "`");
      }
    });
  },
  Java: (data: string) => {
    if (!data.startsWith("package com.example;")) {
      return;
    }
    console.log("maybe Java");
    const reg = /\s{6}Content.builder\(\)\n\s{8}.role\("(\w+)"\)\n\s{8}.parts\(ImmutableList.of\(\n\s{10}Part.fromText\("([\w\W]*?)"\)\n\s{8}\)\)\n\s{8}.build\(\)/g;
    const matchs = data.matchAll(reg).toArray();
    if (matchs.length === 0) {
      return;
    }
    return iter_map_not_null(matchs, (m) => {
      if (m[1] === "model") {
        return jsonEscape(
          m[2]
            .split(
              `"),
          Part.fromText("`,
            )
            .at(-1),
        );
        // ?.replaceAll('\\"', '"');
      }
    });
  },
  AppScript: (data: string) => {
    if (!data.startsWith("// See https://developers.google.com/apps-script/guides/properties")) {
      return;
    }
    console.log("maybe AppScript");
    const reg = /\s{6}\{\n\s{8}role:\s'(\w+)',\n\s{8}parts:\s\[\n\s{10}\{\n\s{12}text:\s`"([\w\W]*?)"`\n\s{10}\},\n\s{8}\]\n\s{6}\}/g;
    const matchs = data.matchAll(reg).toArray();
    if (matchs.length === 0) {
      return;
    }
    return iter_map_not_null(matchs, (m) => {
      if (m[1] === "model") {
        return jsonEscape(
          m[2]
            .split(
              `\`
          },
          {
            text: \``,
            )
            .at(-1),
        );
        // ?.replaceAll("\\`", "`");
      }
    });
  },
  Kotlin: (data: string) => {
    if (!data.startsWith("package <your package>")) {
      return;
    }
    console.log("maybe Kotlin");
    const reg = /\s{4}content\("(\w+)"\)\s\{\n\s{6}text\("([\w\W]*?)"\)\n\s{4}\}/g;
    const matchs = data.matchAll(reg).toArray();
    if (matchs.length === 0) {
      return;
    }
    return iter_map_not_null(matchs, (m) => {
      if (m[1] === "model") {
        return jsonEscape(
          m[2]
            .split(
              `")
      text("`,
            )
            .at(-1),
        );
        // ?.replaceAll('\\"', '"');
      }
    });
  },
  Swift: (data: string) => {
    if (
      !data.startsWith(`/*
You'll need a Firebase project and the `)
    ) {
      return;
    }
    console.log("maybe Swift");
    const reg = /\s{4}ModelContent\(\n\s{6}role:\s"(\w+)",\n\s{6}parts:\s\[\n\s{8}"([\w\W]*?)"\n\s{6}\]\n\s{4}\)/g;
    const matchs = data.matchAll(reg).toArray();
    if (matchs.length === 0) {
      return;
    }
    return iter_map_not_null(matchs, (m) => {
      if (m[1] === "model") {
        return jsonEscape(
          m[2]
            .split(
              `",
        "`,
            )
            .at(-1),
        );
        // ?.replaceAll('\\"', '"');
      }
    });
  },
  Dart: (data: string) => {
    if (
      !data.startsWith(`/*
  You'll need a Firebase project and the `)
    ) {
      return;
    }
    console.log("maybe Dart");
    const reg = /\s{4}Content\('(\w+)',\s\[\n\s{6}TextPart\('([\w\W]*?)'\),\n\s{4}\]\)/g;
    const matchs = data.matchAll(reg).toArray();
    if (matchs.length === 0) {
      return;
    }
    return iter_map_not_null(matchs, (m) => {
      if (m[1] === "model") {
        return jsonEscape(
          m[2]
            .split(
              `'),
      TextPart('`,
            )
            .at(-1),
        );
        // ?.replaceAll('\\"', '"');
      }
    });
  },
};

const jsonEscape = (data?: string) => {
  if (data) {
    return JSON.parse(data);
  }
};

if (import_meta_ponyfill(import.meta).main) {
  const args = parseArgs(process.argv.slice(2), {
    string: ["outDir", "input", "from", "style"],
    boolean: ["watch"],
    alias: {
      W: "watch",
      O: "outDir",
      U: "input",
      F: "from",
      S: "style",
    },
  });

  syncAiResponses(
    args,
    args._.map((a) => a.toString()),
  );
}
