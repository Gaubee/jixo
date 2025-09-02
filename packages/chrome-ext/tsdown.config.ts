import {defineConfig, type UserConfig} from "tsdown";

// 导出一个配置数组，tsdown 会依次执行它们
export default defineConfig(() => {
  type UnArray<T> = (T extends Array<infer U> ? U : T) | T;
  type SimpleUserConfig = UnArray<UserConfig>;

  // 定义一个通用的基础配置，避免重复
  const baseConfig: SimpleUserConfig = {
    outDir: "./bundle/",
    format: "iife",
    dts: false,
    treeshake: true,
    minify: "dce-only",
    platform: "browser",
    noExternal: /./,
    // 关键：在每个独立的构建任务中，也要包含这个选项
    // 以防止单个入口内部的动态 import() 产生 chunk
    outputOptions: {
      inlineDynamicImports: true,
      entryFileNames: "[name].js", // 仅 [name] 即可
    },
  } satisfies SimpleUserConfig;

  return [
    {
      ...baseConfig,
      entry: {
        background: "./service-worker/background.ts",
      } as Record<string, string>,
    } satisfies SimpleUserConfig,
  ] as UserConfig;
});
