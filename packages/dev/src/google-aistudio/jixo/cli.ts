import {parseArgs, type ParseOptions} from "@std/cli/parse-args";
import {import_meta_ponyfill} from "import-meta-ponyfill";
import z from "zod";
import {reactiveFs} from "../../reactive-fs/reactive-fs.js";
import {sync} from "./sync.js";

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
    console.log("\nWatching for file changes... Press Ctrl+C to exit.");
  }
};

if (import_meta_ponyfill(import.meta).main) {
  const args = parseArgs(process.argv.slice(2), {
    string: ["outDir"],
    boolean: ["watch"],
    alias: {
      O: "outDir",
      W: "watch",
    },
  });
  doSync(args);
}
