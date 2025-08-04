import {existsSync, realpathSync, symlinkSync} from "node:fs";
import {unlink} from "node:fs/promises";
import {defineConfig, type UserConfig} from "tsdown";
import {projectResolver} from "./src/utils/resolver.js";

// 导出一个配置数组，tsdown 会依次执行它们
export default defineConfig(() => {
  type UnArray<T> = (T extends Array<infer U> ? U : T) | T;
  type SimpleUserConfig = UnArray<UserConfig>;

  // 定义一个通用的基础配置，避免重复
  const baseConfig: SimpleUserConfig = {
    outDir: "./bundle",
    format: "esm",
    dts: false,
    minify: "dce-only",
    noExternal: /./,
    ignoreWatch: [/[\\/]assets[\\/]/, /[\\/]bundle[\\/]/, /[\\/]dist[\\/]/] as any,
    // 关键：在每个独立的构建任务中，也要包含这个选项
    // 以防止单个入口内部的动态 import() 产生 chunk
    outputOptions: {
      inlineDynamicImports: true,
    },
  } satisfies SimpleUserConfig;

  return [
    {
      ...baseConfig,
      entry: {
        "google-aistudio.browser": "./src/google-aistudio/browser/index.ts",
      } as Record<string, string>,
    } satisfies SimpleUserConfig,
    {
      ...baseConfig,
      entry: {
        "groq.browser": "./src/groq/browser/index.ts",
      },
      // 将 hook 放在最后一个构建任务中，确保它在所有文件都生成后再执行
      hooks: {
        "build:done": async () => {
          console.log("All builds done, creating symlink...");
          const source = projectResolver(`./bundle/`);
          const target = projectResolver(`./assets/bundle`);
          if (existsSync(target) && realpathSync(source) === realpathSync(target)) {
            return;
          }
          await unlink(target).catch(() => {});
          symlinkSync(source, target, "junction");
          console.log("Symlink created.");
        },
      },
    } satisfies SimpleUserConfig,
  ] as UserConfig;
});
