import type {PageConfig} from "./types.js";
import {setPageFunctionCallTools, setPageModel, setPageSystemPrompt, usingSettingPanel} from "./writer.js";

/**
 * Applies a local configuration file to the AI Studio page.
 * @param config - The configuration object to apply.
 */
export const applyPageConfig = async (config: PageConfig) => {
  if (config.systemPrompt) await setPageSystemPrompt(config.systemPrompt);
  if (config.model) await usingSettingPanel(() => setPageModel(config.model));
  if (config.tools) await usingSettingPanel(() => setPageFunctionCallTools(config.tools));
};
