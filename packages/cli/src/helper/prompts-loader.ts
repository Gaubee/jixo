import {createResolverByRootFile} from "@gaubee/node";
import {readJson} from "@gaubee/nodekit";
import {func_remember} from "@gaubee/util";
import type {ModelMessage} from "ai";
import fs from "node:fs";
import defaultPrompts from "../prompts.json" with {type: "json"};
const rootResolver = createResolverByRootFile(import.meta.url);

export const getPromptConfigs = func_remember((): typeof defaultPrompts => {
  const download_prompts_json_filepath = rootResolver("prompts.json");
  if (fs.existsSync(download_prompts_json_filepath)) {
    return readJson(download_prompts_json_filepath);
  }
  return defaultPrompts;
});
type PromptConfigs = typeof defaultPrompts;
type PromptItemConfig = PromptConfigs[keyof PromptConfigs];

export const getModelMessage = (agents: string[]) => {
  const promptConfigs = getPromptConfigs();
  const modelMessage: ModelMessage[] = [];
  const names = agents.slice();
  for (const name of names) {
    const promptConfig = name in promptConfigs ? (Reflect.get(promptConfigs, name) as PromptItemConfig) : null;
    if (!promptConfig) {
      continue;
    }
    modelMessage.unshift({role: "system", content: promptConfig.content});
    names.push(...promptConfig.data.parent);
  }

  return modelMessage;
};
