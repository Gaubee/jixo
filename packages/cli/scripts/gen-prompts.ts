import {createResolverByRootFile, walkFiles, writeJson} from "@gaubee/nodekit";
import {obj_pick} from "@gaubee/util";
import {defu} from "defu";
const rootResolver = createResolverByRootFile(import.meta.url);
const prompts_json: any = {};
for (const mdfile of walkFiles(rootResolver("./prompts"), {
  matchFile: (entry) => entry.name.endsWith(".md"),
})) {
  prompts_json[mdfile.name.replace(".md", "")] = defu(obj_pick(mdfile.readMarkdown(), "content", "data"), {data: {parent: []}});
}

writeJson(rootResolver("./src/prompts.json"), prompts_json);
