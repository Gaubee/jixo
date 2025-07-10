import {createResolverByRootFile, readMarkdown, writeJson} from "@gaubee/nodekit";
import {mkdirSync} from "node:fs";
import {dirname} from "node:path";

const projectResolver = createResolverByRootFile(import.meta.url);
const rootResolver = createResolverByRootFile(import.meta.url, ".jixo/meta.tmp.md");

const promptJsonFilepath = projectResolver("assets/prompt.json");
mkdirSync(dirname(promptJsonFilepath), {recursive: true});

writeJson(promptJsonFilepath, {
  system: readMarkdown(rootResolver(".jixo/meta.tmp.md")).orig.toString(),
});
