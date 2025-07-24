import {defineConfig} from "tsdown";

export default defineConfig(() => {
  return {
    entry: {
      "apply-ai-response": "src/apply-ai-response.ts",
      "gen-prompt": "./src/gen-prompt.ts",
      "google-aistudio": "./src/google-aistudio/jixo/index.ts",
      "reactive-fs": "./src/reactive-fs/reactive-fs.ts",
      "google-aistudio.browser": "./src/google-aistudio/browser/index.ts",
      "google-aistudio.node": "./src/google-aistudio/node/index.ts",
    },
    outDir: "./bundle",
    format: "esm",
    dts: true,
  };
});
