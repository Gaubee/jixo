import {defineEnv} from "@gaubee/node";
import fs from "node:fs";
import path from "node:path";

export const loadJixoEnv = (dir: string) => {
  const cwdJixoEnvFilepath = path.join(dir, ".jixo.env");
  if (fs.existsSync(cwdJixoEnvFilepath)) {
    process.loadEnvFile(cwdJixoEnvFilepath);
  }
};

// Load environment from the current working directory when the module is imported.
loadJixoEnv(process.cwd());

export const safeEnv = defineEnv("JIXO", {
  CORE_URL: "http://localhost:4111",
  API_KEY: "",
});
