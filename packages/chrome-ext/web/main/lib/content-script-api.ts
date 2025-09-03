import { applyPageConfig as applyPageConfigToBrowser, getEasyFs, getTargetNamespace, prepareDirHandle, syncInput, syncOutput } from "@jixo/dev/browser";
import { storeWorkspaceHandle } from "./workspace.ts";
import { func_remember } from "@gaubee/util";
import type { PageConfig } from "@jixo/dev/browser";

// --- API Definition ---
export const mainContentScriptAPI = new class {
  async selectWorkspace(): Promise<string | null> {
    const dirHandle = await prepareDirHandle();
    await storeWorkspaceHandle(dirHandle);
    return dirHandle.name;
  }

  #startSync = func_remember(async (): Promise<{ status: "SYNC_STARTED" | "ERROR"; message?: string }> => {
    try {
      const handle = await prepareDirHandle();
      console.log(`JIXO BROWSER: Starting sync with workspace '${handle.name}'...`);
      void syncOutput();
      void syncInput();
      return { status: "SYNC_STARTED" };
    } catch (e) {
      this.#startSync.reset()
      return { status: "ERROR", message: e instanceof Error ? e.message : String(e) };
    }
  })
  startSync() {
    return this.#startSync()
  }

  async applyPageConfig(config: any): Promise<void> {
    return applyPageConfigToBrowser(config);
  }

  async readConfigFile(isTemplate: boolean): Promise<PageConfig | null> {
    try {
      const fs = await getEasyFs();
      const targetName = getTargetNamespace();
      const filename = isTemplate ? `${targetName}.config-template.json` : `${targetName}.config.json`;
      const content = await fs.readFileText(filename);
      return JSON.parse(content);
    } catch (error) {
      if (error instanceof Error && error.name === "NotFoundError") {
        return null;
      }
      throw error;
    }
  }

  async writeConfigFile(config: object, isTemplate: boolean): Promise<void> {
    const fs = await getEasyFs();
    const targetName = getTargetNamespace();
    const filename = isTemplate ? `${targetName}.config-template.json` : `${targetName}.config.json`;
    await fs.writeFile(filename, JSON.stringify(config, null, 2));
  }

  async ping() {
    return true;
  }
};

export type MainContentScriptAPI = typeof mainContentScriptAPI;
