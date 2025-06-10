import {cyan, gray} from "@gaubee/nodekit";
import {obj_props} from "@gaubee/util";
import {getAllPromptConfigs} from "../../helper/prompts-loader.js";

export const listPrompts = async () => {
  const configs = await getAllPromptConfigs();
  for (const key of obj_props(configs)) {
    const config = configs[key];
    console.log(`- ${cyan(key)}: ${gray(config.content.split("\n")[0])}...`);
    if (config.data.parent.length) {
      console.log(`  parent: ${config.data.parent.map(cyan).join(", ")}`);
    }
  }
};
