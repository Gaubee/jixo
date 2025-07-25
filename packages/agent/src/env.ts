import {defineSafeEnv} from "@gaubee/node";
import fs from "node:fs";
import path from "node:path";
import z from "zod";

export const loadJixoEnv = (dir: string) => {
  const cwdJixoEnvFilepath = path.join(dir, ".jixo.env");
  if (fs.existsSync(cwdJixoEnvFilepath)) {
    process.loadEnvFile(cwdJixoEnvFilepath);
  }
};

// Load environment from the current working directory when the module is imported.
loadJixoEnv(process.cwd());

export const safeEnv = defineSafeEnv({
  JIXO_CORE_URL: z.string().optional().default("http://localhost:4111"),
  JIXO_API_KEY: z.string().optional().default(""),
})();
