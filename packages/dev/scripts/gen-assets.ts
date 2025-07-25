import {blue, createResolverByRootFile, green, writeJson} from "@gaubee/nodekit";
import {import_meta_ponyfill} from "import-meta-ponyfill";
import {mkdirSync} from "node:fs";
import path, {dirname} from "node:path";
import {parseArgs} from "node:util";
import {reactiveFs} from "../src/reactive-fs/reactive-fs.ts";

const doGenAssets = async () => {
  const projectResolver = createResolverByRootFile(import.meta.url);
  const rootResolver = createResolverByRootFile(import.meta.url, "pnpm-workspace.yaml");

  const promptJsonFilepath = projectResolver("assets/prompt.json");
  mkdirSync(dirname(promptJsonFilepath), {recursive: true});

  writeJson(promptJsonFilepath, {
    system: reactiveFs.getFile(rootResolver(".jixo/meta.tmp.md")).get(),
  });
  console.log(blue(new Date().toLocaleTimeString()), green(`[gen-assets]`), "Generated assets in", path.relative(process.cwd(), promptJsonFilepath));
};

if (import_meta_ponyfill(import.meta).main) {
  const {values} = parseArgs({
    options: {
      watch: {
        type: "boolean",
        short: "w",
      },
    },
  });
  reactiveFs.use(doGenAssets, {
    once: !values.watch,
  });
}
