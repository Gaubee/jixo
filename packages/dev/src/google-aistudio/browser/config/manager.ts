import type {PageConfig} from "./types.js";
import {setPageFunctionCallTools, setPageModel, setPageSystemPrompt} from "./writer.js";

/**
 * Applies a local configuration file to the AI Studio page.
 * @param config - The configuration object to apply.
 */
export const applyPageConfig = async (config: PageConfig) => {
  if (config.model) await setPageModel(config.model);
  if (config.systemPrompt) await setPageSystemPrompt(config.systemPrompt);
  if (config.tools) await setPageFunctionCallTools(config.tools);
};
