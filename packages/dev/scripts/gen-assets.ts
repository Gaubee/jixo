import {blue, createResolverByRootFile, green, writeJson} from "@gaubee/nodekit";
import {import_meta_ponyfill} from "import-meta-ponyfill";
import {mkdirSync} from "node:fs";
import path, {dirname} from "node:path";
import {parseArgs} from "node:util";
import {reactiveFs} from "../src/reactive-fs/reactive-fs.ts";
import {assetsResolver} from "../src/utils/resolver.ts";

const doGenAssets = async () => {
  const projectResolver = createResolverByRootFile(import.meta.url, "package.json");

  const promptJsonFilepath = assetsResolver("prompt.json");
  mkdirSync(dirname(promptJsonFilepath), {recursive: true});

  const system_coder = reactiveFs.readFile(projectResolver("res/coder.jixo.md"));
  const system_coder_json = JSON.parse(reactiveFs.readFile(projectResolver("res/coder.jixo.json")));
  writeJson(
    promptJsonFilepath,
    {
      [`coder`]: system_coder,
      [`coder_json`]: system_coder_json,
    },
    {space: 0},
  );
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
