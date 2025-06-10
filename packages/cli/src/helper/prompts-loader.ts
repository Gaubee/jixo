import {createResolverByRootFile} from "@gaubee/node";
import {readJson} from "@gaubee/nodekit";
import {func_remember, obj_props} from "@gaubee/util";
import fs from "node:fs";
import defaultPrompts from "../prompts.json" with {type: "json"};
const rootResolver = createResolverByRootFile(import.meta.url);

export const getAllPromptConfigs = func_remember((): typeof defaultPrompts => {
  const download_prompts_json_filepath = rootResolver("prompts.json");
  if (fs.existsSync(download_prompts_json_filepath)) {
    return readJson(download_prompts_json_filepath);
  }
  return defaultPrompts;
});
export type PromptConfigs = typeof defaultPrompts;
export type PromptItemConfig = PromptConfigs[keyof PromptConfigs];

/**
 * 所有的技能信息
 * key: skill-name
 * value: skill-description
 */
export const getAllSkillMap = func_remember(() => {
  const configs = getAllPromptConfigs();
  const skills = obj_props(configs).filter((key) => key.endsWith(".skill"));
  const allSkillMap = skills.reduce(
    (tree, skill) => {
      tree[skill] = configs[skill].content.split("\n")[0];
      return tree;
    },
    Object.create(null) as Record<string, string>,
  );
  return allSkillMap;
});
