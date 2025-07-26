import {existsSync, realpathSync, symlinkSync} from "node:fs";
import {unlink} from "node:fs/promises";
import {defineConfig, type UserConfig} from "tsdown";
import {projectResolver} from "./src/utils/resolver.js";

export default defineConfig(() => {
  return {
    entry: {
      "google-aistudio.browser": "./src/google-aistudio/browser/index.ts",
      "google-aistudio.node": "./src/google-aistudio/node/cli.ts",
    },
    outDir: "./bundle",
    format: "esm",
    dts: false,
    minify: "dce-only",
    ignoreWatch: [/[\\/]assets[\\/]/, /[\\/]bundle[\\/]/, /[\\/]dist[\\/]/] as any,
    hooks: {
      "build:done": async () => {
        const source = projectResolver(`./bundle/`);
        const target = projectResolver(`./assets/bundle`);
        if (existsSync(target) && realpathSync(source) === realpathSync(target)) {
          return;
        }
        /// 做一次强制的unlink，因为windows系统的一些奇怪行为:junction的原始对象被删除了之后，留下symbol是没法通过 existsSync 或者 statSync 查询出来的。
        await unlink(target).then(() => {});
        symlinkSync(source, target, "junction");
      },
    },
  } satisfies UserConfig;
});
