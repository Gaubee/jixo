import {defineConfig} from "tsdown";

export default defineConfig(() => {
  return {
    entry: {
      "google-aistudio.browser": "./src/google-aistudio/browser/index.ts",
      "google-aistudio.node": "./src/google-aistudio/node/cli.ts",
    },
    outDir: "./bundle",
    format: "esm",
    dts: false,
  };
});
