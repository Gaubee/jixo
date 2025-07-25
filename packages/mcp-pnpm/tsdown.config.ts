import {defineConfig} from "tsdown";

export default defineConfig(() => {
  return {
    entry: 'src/index.ts',
    outDir: "./bundle",
    format: "esm",
    noExternal: /./,
    dts: false,
  };
});
