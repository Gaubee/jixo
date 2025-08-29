import {blue, createResolver, createResolverByRootFile, green, normalizeFilePath, writeJson} from "@gaubee/nodekit";
import {import_meta_ponyfill} from "import-meta-ponyfill";
import {mkdirSync} from "node:fs";
import path, {dirname} from "node:path";
import {pathToFileURL} from "node:url";
import {parseArgs} from "node:util";
import {reactiveFs} from "../src/reactive-fs/reactive-fs.ts";
import {assetsResolver} from "../src/utils/resolver.ts";

const doGenAssets = async () => {
  {
    const projectResolver = createResolverByRootFile(import.meta.url, "package.json");

    const promptJsonFilepath = assetsResolver("prompt.json");
    mkdirSync(dirname(promptJsonFilepath), {recursive: true});

    const filepaths = reactiveFs.readDirByGlob(projectResolver.dirname, "res/**");
    const prompt_json_content: Record<string, any> = {};
    for (const filepath of filepaths) {
      const filename_info = path.parse(filepath);
      const file_content = reactiveFs.readFile(projectResolver(filepath));
      if (filename_info.base.endsWith(".jixo.md")) {
        prompt_json_content[filename_info.base.replace(".jixo.md", "")] = file_content;
      } else if (/^.(json|ts|js|mts|mjs)$/.test(filename_info.ext)) {
        prompt_json_content[normalizeFilePath(path.relative(projectResolver.dirname, filepath))] = await import(pathToFileURL(filepath).href).then((r) => r.default);
      } else {
        prompt_json_content[normalizeFilePath(path.relative(projectResolver.dirname, filepath))] = file_content;
      }
    }
    writeJson(promptJsonFilepath, prompt_json_content, {space: 0});
    console.log(blue(new Date().toLocaleTimeString()), green(`[gen-assets]`), "Generated assets in", path.relative(process.cwd(), promptJsonFilepath));
  }
  /// tools
  {
    const toolsResolver = createResolver(createResolverByRootFile(import.meta.url, "tools/deno.json").dirname + "/tools/src");

    const toolsJsonFilepath = assetsResolver("tools.json");
    mkdirSync(dirname(toolsJsonFilepath), {recursive: true});

    const filepaths = reactiveFs.readDirByGlob(toolsResolver.dirname, "*.function_call.ts");
    const tools_json_content: Record<string, string> = {};
    for (const filepath of filepaths) {
      const file_content = reactiveFs.readFile(toolsResolver(filepath));
      const filename_info = path.parse(filepath);
      tools_json_content[filename_info.base] = file_content;
    }
    writeJson(toolsJsonFilepath, tools_json_content, {space: 0});
    console.log(blue(new Date().toLocaleTimeString()), green(`[gen-assets]`), "Generated assets in", path.relative(process.cwd(), toolsJsonFilepath));
  }
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
