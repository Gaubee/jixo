import {createResolverByRootFile} from "@gaubee/node";
import {readJson} from "@gaubee/nodekit";
import {func_remember} from "@gaubee/util";
import fs from "node:fs";
import defaultPrompts from "../prompts.json" with {type: "json"};
const rootResolver = createResolverByRootFile(import.meta.url);

const getPromptsConfig = func_remember((): typeof defaultPrompts => {
  const download_prompts_json_filepath = rootResolver("prompts.json");
  if (fs.existsSync(download_prompts_json_filepath)) {
    return readJson(download_prompts_json_filepath);
  }
  return defaultPrompts;
});

export const getModelMessage = ()=>{
    
}