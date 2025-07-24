import {blue, createResolverByRootFile, green, walkFiles, writeJson} from "@gaubee/nodekit";
import {obj_pick} from "@gaubee/util";
import watcher from "@parcel/watcher";
import {defu} from "defu";
import {import_meta_ponyfill} from "import-meta-ponyfill";

const rootResolver = createResolverByRootFile(import.meta.url);
const promptsDir = rootResolver("./prompts");
const writePromptsJson = () => {
  const prompts_json: any = {};
  for (const mdfile of walkFiles(promptsDir, {
    matchFile: (entry) => entry.name.endsWith(".md") && !entry.name.endsWith("-zh.md"),
  })) {
    prompts_json[mdfile.name.replace(".md", "")] = defu(obj_pick(mdfile.readMarkdown(), "content", "data"), {data: {parent: []}});
  }
  writeJson(rootResolver("./src/prompts.json"), prompts_json);
  console.log(blue(new Date().toLocaleTimeString()), green(`✅ prompts.json updated`));
};

if (import_meta_ponyfill(import.meta).main) {
  writePromptsJson();
  if (process.argv.includes("--watch")) {
    watcher.subscribe(promptsDir, () => {
      writePromptsJson();
    });
  }
}
