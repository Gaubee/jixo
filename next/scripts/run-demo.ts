import {$, createResolverByRootFile} from "@gaubee/nodekit";
import fs from "node:fs";
const rootResolver = createResolverByRootFile(import.meta.url);

fs.mkdirSync(rootResolver("demo"), {recursive: true});
$.cd(rootResolver("demo"));
await $`node ../dist/mastra/index.demo.js`;
