import {cosmiconfig} from "cosmiconfig";
import {defu} from "defu";
import z from "zod";
const DEFAULT_CORE_URL = "http://localhost:4111";
const zJixoConfig = z.object({
  coreUrl: z.string().url().optional().default(DEFAULT_CORE_URL),
});

const defaultConfig: JixoConfig = {
  coreUrl: DEFAULT_CORE_URL,
};

export type JixoConfig = z.output<typeof zJixoConfig>;

export const defineConfig = (config: Partial<JixoConfig>) => {
  return zJixoConfig.parse(config);
};

export const loadConfig = async (dir: string): Promise<JixoConfig> => {
  const explorer = cosmiconfig("jixo", {
    searchStrategy: "global",
  });
  const loaded = await explorer.search(dir);
  // Use Zod to parse the loaded config, which applies defaults if properties are missing.
  return defu(zJixoConfig.parse(loaded?.config || {}), defaultConfig);
};
console.log(defineConfig({}));
