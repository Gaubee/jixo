import {createResolverByRootFile} from "@gaubee/nodekit";
import {defineConfig} from "rolldown";
const rootResolver = createResolverByRootFile(import.meta.url);
export default defineConfig({
  input: rootResolver("index.ts"),
  cwd: rootResolver(),
  //   watch: process.argv.includes("--watch") ? {} : false,
  output: {
    dir: rootResolver("bundle"),
    format: "esm",
    sourcemap: true,
  },
});
