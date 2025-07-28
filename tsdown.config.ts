import {defineConfig, type UserConfig} from "tsdown";
export default defineConfig(() => {
  return {
    entry: "index.ts",
    outDir: "bundle",
    platform: "node",
    format: "cjs",
  } satisfies UserConfig;
});
