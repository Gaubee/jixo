import {getEasyFs, getTargetNamespace, prepareDirHandle, setFunctionCallTools, setModel, setSystemPrompt, syncInput, syncOutput} from "@jixo/dev/browser";
import {z} from "zod";
import {storeWorkspaceHandle} from "./workspace.ts";

const ConfigSchema = z
  .object({
    systemPrompt: z.string().optional(),
    tools: z.array(z.any()).optional(),
    model: z.string().optional(),
  })
  .partial();

// --- API Definition ---
export const mainContentScriptAPI = {
  async selectWorkspace(): Promise<string | null> {
    const dirHandle = await prepareDirHandle();
    await storeWorkspaceHandle(dirHandle);
    return dirHandle.name;
  },
  async startSync(): Promise<{status: "SYNC_STARTED" | "ERROR"; message?: string}> {
    const handle = await prepareDirHandle();
    if (!handle) return {status: "ERROR", message: "Workspace not selected."};
    console.log(`JIXO BROWSER: Starting sync with workspace '${handle.name}'...`);
    void syncOutput();
    void syncInput();
    return {status: "SYNC_STARTED"};
  },
  async applyConfig(): Promise<{status: "SUCCESS" | "ERROR"; message?: string; appliedSettings: string[]}> {
    try {
      const fs = await getEasyFs();
      const configPath = `${getTargetNamespace()}.config.json`;
      if (!(await fs.exists(configPath))) {
        const templatePath = `${getTargetNamespace()}.config-template.json`;
        if (await fs.exists(templatePath)) {
          const templateContent = await fs.readFileText(templatePath);
          await fs.writeFile(configPath, templateContent);
        } else {
          return {status: "ERROR", message: `Config file not found: ${configPath}`, appliedSettings: []};
        }
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
      return {status: "ERROR", message: error.message, appliedSettings: []};
    }
  },

  ping() {
    return true;
  },
};

export type MainContentScriptAPI = typeof mainContentScriptAPI;
