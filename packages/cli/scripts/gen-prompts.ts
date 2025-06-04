import {createResolverByRootFile, walkFiles, writeJson} from "@gaubee/nodekit";
const rootResolver = createResolverByRootFile(import.meta.url);
const prompts_json: any = {};
for (const mdfile of walkFiles(rootResolver("./prompts"), {
  matchFile: (entry) => entry.name.endsWith(".md"),
})) {
  prompts_json[mdfile.name.replace(".md", "")] = mdfile.readText();
}

writeJson(rootResolver("./src/prompts.json"), prompts_json);
