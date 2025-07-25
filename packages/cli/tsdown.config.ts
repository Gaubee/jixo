import {defineConfig, type UserConfig} from "tsdown";

export default defineConfig(() => {
  return {
    entry: "src/index.ts",
    outDir: "./bundle",
    format: "esm",
    noExternal: /./,
    dts: false,
    minify: false,
    external: ["@parcel/watcher"],
  } satisfies UserConfig;
});
