// import path from "node:path";
// import {createJixoApp} from "./app.js";

// const workDir = path.join(process.cwd(), "./");

// export const mastra = await createJixoApp(workDir);

import {createResolverByRootFile, red} from "@gaubee/nodekit";
import {Mastra} from "@mastra/core";
import {existsSync} from "node:fs";
import {jixoAppConfigFactory} from "./app.js";
const rootResolver = createResolverByRootFile(import.meta.url, "tsconfig.json");
if (typeof process.loadEnvFile === "function") {
  const envFile = rootResolver(".env");
  if (!existsSync(envFile)) {
    console.error(red(`.env file not found at ${envFile}. Please create one with the necessary environment variables.`));
    process.exit(1);
  }
  process.loadEnvFile(envFile);
}

const workDir = rootResolver.dirname;
const config = await jixoAppConfigFactory({
  workDir,
  logLevel: "debug",
});

export const mastra = new Mastra(config);
