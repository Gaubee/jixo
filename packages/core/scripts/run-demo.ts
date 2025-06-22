import {$, createResolverByRootFile} from "@gaubee/nodekit";
import fs from "node:fs";
const rootResolver = createResolverByRootFile(import.meta.url);
const demoDir = rootResolver("demo");
if (process.argv.includes("--init")) {
  fs.rmSync(demoDir, {recursive: true, force: true});
}
fs.mkdirSync(demoDir, {recursive: true});
$.cd(rootResolver("demo"));

await $`node ../dist/demo.js`;
