import {blue, gray, green} from "@gaubee/nodekit";
import {iter_map_not_null} from "@gaubee/util";
import {type ParseOptions} from "@std/cli/parse-args";
import {globbySync} from "globby";
import {createHash} from "node:crypto";
import {statSync} from "node:fs";
import {mkdir, rm, writeFile} from "node:fs/promises";
import path from "node:path";
import z from "zod";
import {reactiveFs} from "../../reactive-fs/reactive-fs.js";
import {zContentSchema} from "../node/types.js";
export const sync = async (basePath: string, outDir?: string) => {
  const s = statSync(basePath);
  if (s.isDirectory()) {
    for (const contentsJsonFile of reactiveFs.readDir(basePath, "*.contents.json").get()) {
      sync(path.join(basePath, contentsJsonFile), outDir);
    }
    return;
  }

  const rawContents = reactiveFs.getFile(basePath).get();
  const safeContents = await zContentSchema.safeParseAsync(
    (() => {
      try {
        return JSON.parse(rawContents);
      } catch {}
    })(),
  );
  if (safeContents.error) {
    console.error(safeContents.error.message);
    return;
  }
  const contents = safeContents.data;

  let first_index = 0;
  let second_index = -1;
  const modelHistory = iter_map_not_null(contents.generateContentParameters.contents, (content) => {
    if (content.role === "model") {
      const textParts = content.parts.filter((p) => "text" in p);
      return textParts.at(-1)?.text;
    }
  });
  /** 文件名前缀 */
  const name_prefix = path.basename(basePath).split(".")[0];
  const name_len = 2; // 固定长度，避免抖动
  const model_files = modelHistory.map((content) => {
    if (/【变更日志】[*\s\n]+/.test(content)) {
      first_index += 1;
      second_index = 0;
    } else {
      second_index += 1;
    }
    const hash = createHash("sha256").update(content).digest("hex").slice(0, 6);
    const name = `${first_index}`.padStart(name_len, "0") + "-" + `${second_index}`.padStart(name_len, "0") + `.${hash}.md`;
    return {name, content};
  });

  const resolvedOutDir = path.join(outDir ?? path.dirname(basePath), name_prefix);
  await mkdir(resolvedOutDir, {recursive: true});

  const oldFileNames = new Set(globbySync(`*.md`, {cwd: resolvedOutDir}));
  const newFileNames = new Set(model_files.map((file) => file.name));
  const rmFileNameList = [...oldFileNames].filter((x) => !newFileNames.has(x));
  const addFileNames = new Set([...newFileNames].filter((x) => !oldFileNames.has(x)));

  /// 删除废弃的文件
  if (rmFileNameList.length) {
    await Promise.all(rmFileNameList.map((name) => rm(path.join(resolvedOutDir, name))));
  }
  /// 保存新增的文件
  await Promise.all(model_files.filter((file) => addFileNames.has(file.name)).map((file) => writeFile(path.join(resolvedOutDir, file.name), file.content)));

  console.log(blue(new Date().toLocaleTimeString()), green("sync"), path.relative(process.cwd(), basePath));
};

// 定义与 yargs 兼容的参数选项类型
// 这样可以确保 doSync 的参数与 yargs 的解析结果兼容
export interface SyncOptions extends ParseOptions {
  outDir?: string;
  watch?: boolean;
  // yargs 解析后的位置参数会放在 `_` 数组中
  _: (string | number)[];
}

/**
 * 封装了 sync 命令的核心执行逻辑
 * @param args - 命令行参数，符合 yargs 解析后的结构
 */
export const doSync = (args: SyncOptions) => {
  reactiveFs.use(
    async () => {
      // 从 yargs 的 `_` 数组中获取位置参数
      // z.string().safeParse(args._[0]).data ?? process.cwd() 的写法是健壮的，
      // 它处理了用户未提供路径的情况，优雅地降级到当前工作目录。
      const targetPath = z.string().safeParse(args._[0]).data ?? process.cwd();
      await sync(targetPath, args.outDir);
    },
    {
      once: !args.watch,
    },
  );

  if (args.watch) {
    console.log(gray("\nWatching for file changes... Press Ctrl+C to exit."));
  }
};
