import {blue, gray, green, red} from "@gaubee/nodekit";
import {delay, iter_map_not_null} from "@gaubee/util";
import {type ParseOptions} from "@std/cli/parse-args";
import Debug from "debug";
import {globbySync} from "globby";
import {createHash} from "node:crypto";
import {statSync} from "node:fs";
import {mkdir, rm, writeFile} from "node:fs/promises";
import path from "node:path";
import z from "zod";
import {reactiveFs} from "../../reactive-fs/reactive-fs.js";
import {zContentsSchema} from "../node/types.js";
const debug = Debug("jixo:go-sync");

const saveMdFiles = async (baseDir: string, files: Array<{content: string; name: string}>) => {
  const oldFileNames = new Set(globbySync(`*.md`, {cwd: baseDir}));
  const newFileNames = new Set(files.map((file) => file.name));
  const rmFileNameList = [...oldFileNames].filter((x) => !newFileNames.has(x));
  const addFileNames = new Set([...newFileNames].filter((x) => !oldFileNames.has(x)));

  /// 删除废弃的文件
  if (rmFileNameList.length) {
    await Promise.all(rmFileNameList.map((name) => rm(path.join(baseDir, name))));
  }
  /// 保存新增的文件
  await Promise.all(
    files
      //
      .filter((file) => addFileNames.has(file.name))
      .map((file) => writeFile(path.join(baseDir, file.name), file.content)),
  );
};

export const sync = async (basePath: string, outDir?: string) => {
  const s = statSync(basePath);
  if (s.isDirectory()) {
    for (const contentsJsonFile of reactiveFs.readDirByGlob(basePath, "*.contents.json")) {
      await sync(path.join(basePath, contentsJsonFile), outDir);
    }
    return;
  }

  debug("发现contents.json文件", basePath);
  const rawContents = reactiveFs.readFile(basePath);
  const safeContents = await zContentsSchema.safeParseAsync(
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

  type ContentItem = (typeof contents)[number];
  const getItemContent = (item: ContentItem) => {
    const textParts = item.parts.filter((p) => "text" in p);
    const content = textParts.at(-1)?.text;
    return content;
  };

  /** 文件名前缀 */
  const name_prefix = path.basename(basePath).split(".")[0];
  const name_len = 2; // 固定长度，避免抖动
  let first_index = 0;
  let second_index = -1;
  const user_files: Array<{content: string; name: string}> = [];
  const model_files = iter_map_not_null(contents, (item, index) => {
    if (item.role === "model") {
      const content = getItemContent(item);
      if (content) {
        if (/【变更日志】[*\s\n]+/.test(content)) {
          first_index += 1;
          second_index = 0;
        } else {
          second_index += 1;
        }
        const hash = createHash("sha256").update(content).digest("hex").slice(0, 6);
        const name = `${first_index}`.padStart(name_len, "0") + "-" + `${second_index}`.padStart(name_len, "0") + `.${hash}.md`;

        {
          const preItem = contents.at(index - 1);
          if (preItem?.role === "user") {
            const userContent = getItemContent(preItem);
            if (userContent) {
              const hash = createHash("sha256").update(userContent).digest("hex").slice(0, 6);
              const userFilename = `${first_index}`.padStart(name_len, "0") + "-" + `${second_index}`.padStart(name_len, "0") + `.${hash}.md`;

              user_files.push({content: userContent, name: userFilename});
            }
          }
        }

        return {content, name};
      }
    }
  });

  /// 保存
  const modelOutputDir = path.join(outDir ?? path.dirname(basePath), name_prefix);
  await mkdir(modelOutputDir, {recursive: true});
  const userOutputDir = path.join(modelOutputDir, "user");
  await mkdir(userOutputDir, {recursive: true});

  await saveMdFiles(modelOutputDir, model_files);
  await saveMdFiles(userOutputDir, user_files);

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
  // 从 yargs 的 `_` 数组中获取位置参数
  // z.string().safeParse(args._[0]).data ?? process.cwd() 的写法是健壮的，
  // 它处理了用户未提供路径的情况，优雅地降级到当前工作目录。
  const targetPath = z.string().safeParse(args._[0]).data ?? process.cwd();

  // const debounceSync = func_debounce(async () => {
  //   await sync(targetPath, args.outDir);
  // }, 200);
  reactiveFs.use(
    async () => {
      console.log(red("start"));
      await (async () => {
        await delay(100);
        console.log(reactiveFs.readFile(path.resolve(targetPath, "../package.json")).length);
      })();
      // await debounceSync();
      await sync(targetPath, args.outDir);
      console.log(red("end"));
    },
    {
      once: !args.watch,
      fileWatchOptions: {
        interval: 500,
      },
    },
  );

  if (args.watch) {
    console.log(gray("\nWatching for file changes... Press Ctrl+C to exit."));
  }
};
