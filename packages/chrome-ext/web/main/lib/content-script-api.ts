import type {PageConfig} from "@jixo/dev/browser";
import {applyPageConfig as applyPageConfigToBrowser, getEasyFs, getTargetNamespace, prepareDirHandle, restoreDirHandle, syncInput, syncOutput} from "@jixo/dev/browser";
import {getWorkspaceHandle, storeWorkspaceHandle, unsetWorkspaceHandle} from "./workspace.ts";

// --- API Definition ---
export const mainContentScriptAPI = new (class {
  #syncAbortController: AbortController | null = null;

  async getWorkspaceHandleName(): Promise<string | null> {
    const handle = await getWorkspaceHandle();
    return handle?.name || null;
  }
  async #requestWorkspaceHandle() {
    // First, try to get the stored handle.
    const restoredHandle = await getWorkspaceHandle();

    // Pass it to the request function. It will be used if valid, otherwise a picker is shown.
    await restoreDirHandle(restoredHandle);
    const handle = await prepareDirHandle();

    // Store the potentially new handle.
    await storeWorkspaceHandle(handle);
    return handle;
  }

  async requestWorkspaceHandleName(force?: boolean): Promise<string | null> {
    if (force) {
      await unsetWorkspaceHandle();
    }
    const handle = await this.#requestWorkspaceHandle();
    return handle?.name || null;
  }

  async isSyncing() {
    return this.#syncAbortController != null;
  }

  async updateWorkspaceHandle(startSync?: boolean) {
    const isSyncing = await this.isSyncing();
    if (isSyncing) {
      await this.stopSync();
    }
    const result = await this.requestWorkspaceHandleName(true);
    if (startSync ?? isSyncing) {
      await this.startSync();
    }
    return result;
  }

  async startSync(): Promise<{status: "SYNC_STARTED" | "ERROR"; message?: string}> {
    if (this.#syncAbortController) {
      this.#syncAbortController.abort();
    }
    this.#syncAbortController = new AbortController();
    const signal = this.#syncAbortController.signal;

    try {
      const handle = await this.#requestWorkspaceHandle();
      if (!handle) throw new Error("Workspace not available for sync.");
      console.log(`JIXO BROWSER: Starting sync with workspace '${handle.name}'...`);
      void syncOutput(signal);
      void syncInput(signal);
      return {status: "SYNC_STARTED"};
    } catch (e) {
      this.#syncAbortController = null;
      return {status: "ERROR", message: e instanceof Error ? e.message : String(e)};
    }
  }

  async stopSync(): Promise<void> {
    this.#syncAbortController?.abort();
    this.#syncAbortController = null;
    console.log("JIXO BROWSER: Sync stopped.");
  }

  async #applyPageConfig(config: PageConfig): Promise<void> {
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

  async applyConfigFile(): Promise<{status: "SUCCESS" | "ERROR"; message?: string}> {
    const config = await this.readConfigFile(false);
    if (!config) {
      return {status: "ERROR", message: "Config file (config.json) not found."};
    }
    return {status: "SUCCESS"};
  }

  async applyTemplateConfigFile(): Promise<{status: "SUCCESS" | "ERROR"; message?: string}> {
    const templateConfig = await this.readConfigFile(true);
    if (!templateConfig) {
      return {status: "ERROR", message: "Config template not found."};
    }
    await this.writeConfigFile(templateConfig, false);
    await this.#applyPageConfig(templateConfig);
    return {status: "SUCCESS"};
  }

  async ping() {
    return true;
  }
})();

export type MainContentScriptAPI = typeof mainContentScriptAPI;
