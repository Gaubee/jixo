import {defineConfig} from "tsdown";
export default defineConfig(() => {
  return {
    entry: "index.ts",
    outDir: "bundle",
    platform: "node",
    format: "esm",
  };
});
