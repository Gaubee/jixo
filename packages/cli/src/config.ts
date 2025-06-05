import {cosmiconfig} from "cosmiconfig";
import {defu} from "defu";
import z from "zod";

const zJixoTask = z.union([
  z.string(),
  z.object({
    type: z.literal("file"),
    name: z.string().optional(),
    filename: z.string(),
  }),
  z.object({
    type: z.literal("dir"),
    dirname: z.string(),
  }),
  z.object({
    type: z.literal("prompt"),
    name: z.string().optional(),
    content: z.string(),
  }),
]);
const zJixoConfig = z.object({
  tasks: z.union([z.array(zJixoTask), zJixoTask]),
});

const defaultConfig: JixoConfig = {
  tasks: {type: "dir", dirname: ".jixo"},
};
export type JixoTask = z.output<typeof zJixoTask>;
export type JixoConfig = z.output<typeof zJixoConfig>;
export const defineConfig = (config: Partial<JixoConfig>) => {
  return zJixoConfig.parse(config);
};

export const loadConfig = async (dir: string) => {
  const explorer = cosmiconfig("jixo");
  const loaded = await explorer.search(dir);
  return defu(loaded?.config as JixoConfig, defaultConfig);
};
