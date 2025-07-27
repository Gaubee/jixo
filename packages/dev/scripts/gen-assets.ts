import {blue, createResolverByRootFile, green, writeJson} from "@gaubee/nodekit";
import {import_meta_ponyfill} from "import-meta-ponyfill";
import {mkdirSync} from "node:fs";
import path, {dirname} from "node:path";
import {parseArgs} from "node:util";
import {reactiveFs} from "../src/reactive-fs/reactive-fs.ts";
import {assetsResolver} from "../src/utils/resolver.ts";

const doGenAssets = async () => {
  const rootResolver = createResolverByRootFile(import.meta.url, "pnpm-workspace.yaml");

  const promptJsonFilepath = assetsResolver("prompt.json");
  mkdirSync(dirname(promptJsonFilepath), {recursive: true});

  const system_coder = reactiveFs.getFile(rootResolver(".jixo/meta.tmp.md")).get();
  writeJson(promptJsonFilepath, {
    system: system_coder,
    coder: system_coder,
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
