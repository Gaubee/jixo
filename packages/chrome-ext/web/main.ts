import {getEasyFs, getTargetNamespace, prepareDirHandle, setFunctionCallTools, setModel, setSystemPrompt, syncInput, syncOutput} from "@jixo/dev/browser";
import {expose} from "comlink";
import {z} from "zod";
import {createEndpoint} from "../service-worker/lib/comlink-extension/index.ts";

console.log("JIXO CS: Content script loaded.");
let isSyncActive = false;

// Define a schema for our config file for safe parsing.
const ConfigSchema = z
  .object({
    systemPrompt: z.string().optional(),
    tools: z.array(z.any()).optional(), // Keeping tools flexible for now
    model: z.string().optional(),
  })
  .partial();

// --- API Definition for this Content Script ---
const contentScriptAPI = {
  async selectWorkspace(): Promise<string | null> {
    const dirHandle = await prepareDirHandle();
    return dirHandle.name;
  },
  async startSync(): Promise<{status: "SYNC_STARTED" | "ERROR"; message?: string}> {
    if (isSyncActive) {
      return {status: "ERROR", message: "Sync is already active."};
    }
    const handle = await prepareDirHandle();
    if (!handle) {
      return {status: "ERROR", message: "Workspace not selected. Please call selectWorkspace() first."};
    }
    isSyncActive = true;
    console.log(`JIXO BROWSER: Starting sync with workspace '${handle.name}'...`);
    void syncOutput();
    void syncInput();
    return {status: "SYNC_STARTED"};
  },

  /**
   * Reads config.json from the workspace and applies its settings to the page.
   */
  async applyConfig(): Promise<{status: "SUCCESS" | "ERROR"; message?: string; appliedSettings: string[]}> {
    try {
      const fs = await getEasyFs();
      const configPath = `${getTargetNamespace()}.config.json`;

      if (!(await fs.exists(configPath))) {
        const templatePath = `${getTargetNamespace()}.config-template.json`;
        if (!(await fs.exists(templatePath))) {
          return {status: "ERROR", message: `Neither ${configPath} nor ${templatePath} found.`, appliedSettings: []};
        }
        // If template exists but config doesn't, copy it.
        const templateContent = await fs.readFileText(templatePath);
        await fs.writeFile(configPath, templateContent);
      }

      const configContent = await fs.readFileText(configPath);
      const config = ConfigSchema.parse(JSON.parse(configContent));

      const appliedSettings: string[] = [];

      if (config.systemPrompt) {
        await setSystemPrompt(config.systemPrompt);
        appliedSettings.push("systemPrompt");
      }
      if (config.tools) {
        await setFunctionCallTools(config.tools);
        appliedSettings.push("tools");
      }
      if (config.model) {
        await setModel(config.model);
        appliedSettings.push("model");
      }

      return {status: "SUCCESS", appliedSettings};
    } catch (error: any) {
      console.error("JIXO CS: Error applying config:", error);
      return {status: "ERROR", message: error.message, appliedSettings: []};
    }
  },

  ping() {
    return true;
  },
};

export type ContentScriptAPI = typeof contentScriptAPI;

// --- Connection to Background Script ---
function connectToBackground() {
  const port = chrome.runtime.connect({name: "content-script"});
  expose(contentScriptAPI, createEndpoint(port));
  console.log("JIXO CS: Exposed content script API on port to background.");
}

try {
  connectToBackground();
} catch (error) {
  console.error("JIXO CS: Failed to connect and expose API to background script.", error);
}
