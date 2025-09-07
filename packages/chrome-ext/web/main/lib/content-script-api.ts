import type {PageConfig, Snapshot} from "@jixo/dev/browser";
import {
  applyPageConfig as applyPageConfigToBrowser,
  clearPageHistory,
  getEasyFs,
  pickDirHandle,
  prepareDirHandle,
  restoreDirHandle,
  syncInput,
  syncOutput,
  whenFileChanged,
} from "@jixo/dev/browser";
import {Comlink} from "@jixo/dev/comlink";
import {KeyValStore} from "@jixo/dev/idb-keyval";
import {getWorkspaceHandle, storeWorkspaceHandle} from "./workspace.ts";

const settingsStore = new KeyValStore<{isSyncEnabled?: boolean}>("jixo-settings");

// --- API Definition ---
export class MainContentScriptAPI {
  constructor(readonly sessionId: string) {}
  #syncAbortController: AbortController | null = null;

  async getWorkspaceHandleName(): Promise<string | null> {
    const handle = await getWorkspaceHandle(this.sessionId);
    return handle?.name || null;
  }
  async #requestWorkspaceHandle() {
    // First, try to get the stored handle.
    const restoredHandle = await getWorkspaceHandle(this.sessionId);

    // Pass it to the request function. It will be used if valid, otherwise a picker is shown.
    await restoreDirHandle(restoredHandle);
    const handle = await prepareDirHandle();

    // Store the potentially new handle.
    await storeWorkspaceHandle(this.sessionId, handle);
    return handle;
  }

  async isSyncing() {
    return this.#syncAbortController != null;
  }

  async updateWorkspaceHandle(startSync?: boolean) {
    /// 先确保选择并存储了新的文件夹
    await storeWorkspaceHandle(this.sessionId, await pickDirHandle());
    // 暂停现有的同步任务
    const isSyncing = await this.isSyncing();
    if (isSyncing) {
      await this.stopSync();
    }
    /// 将新的文件夹存储为当前工作空间
    const newHandle = await this.#requestWorkspaceHandle();
    // 恢复同步
    if (startSync ?? isSyncing) {
      await this.startSync();
    }
    return newHandle?.name ?? null;
  }
  initScriptFile = async () => {
    const handle = await this.#requestWorkspaceHandle();
    // handle.getFileHandle("click-me.sh",()=>)
  };

  startSync = Comlink.clone(async (): Promise<{status: "SYNC_STARTED" | "SYNC_DISABLED" | "ERROR"; message?: string}> => {
    const settings = await settingsStore.get(this.sessionId);
    if (settings?.isSyncEnabled === false) {
      console.log("JIXO BROWSER: Sync is disabled by user settings.");
      return {status: "SYNC_DISABLED"};
    }

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
  });

  async stopSync(): Promise<void> {
    this.#syncAbortController?.abort();
    this.#syncAbortController = null;
    console.log("JIXO BROWSER: Sync stopped.");
  }

  async #applyPageConfig(config: PageConfig): Promise<void> {
    console.log("JIXO BROWSER: Applying page config...", config);
    try {
      await applyPageConfigToBrowser(config);
    } catch (error) {
      console.error("JIXO BROWSER: Failed to apply page config.", error);
      throw error; // Re-throw to let the caller know
    }
  }

  async readConfigFile(sessionId: string, isTemplate: boolean): Promise<PageConfig | null> {
    try {
      const fs = await getEasyFs();
      const filename = isTemplate ? `${sessionId}.config-template.json` : `${sessionId}.config.json`;
      const content = await fs.readFileText(filename);
      return JSON.parse(content);
    } catch (error) {
      if (error instanceof Error && error.name === "NotFoundError") {
        return null;
      }
      throw error;
    }
  }

  async writeConfigFile(sessionId: string, isTemplate: boolean, configJson: string): Promise<void> {
    const fs = await getEasyFs();
    const filename = isTemplate ? `${sessionId}.config-template.json` : `${sessionId}.config.json`;
    await fs.writeFile(filename, configJson);
  }

  applyConfigFile = Comlink.clone(async (sessionId: string): Promise<{status: "SUCCESS" | "ERROR"; message?: string}> => {
    const config = await this.readConfigFile(sessionId, false);
    if (!config) {
      return {status: "ERROR", message: "Config file (config.json) not found."};
    }
    await this.#applyPageConfig(config);
    return {status: "SUCCESS"};
  });

  applyTemplateConfigFile = Comlink.clone(async (sessionId: string): Promise<{status: "SUCCESS" | "ERROR"; message?: string}> => {
    const templateConfig = await this.readConfigFile(sessionId, true);
    if (!templateConfig) {
      return {status: "ERROR", message: "Config template not found."};
    }
    await this.writeConfigFile(sessionId, false, JSON.stringify(templateConfig, null, 2));
    await this.#applyPageConfig(templateConfig);
    return {status: "SUCCESS"};
  });

  // Expose the new file watching utility
  whenFileChanged = (...args: Parameters<typeof whenFileChanged>) => {
    const res = whenFileChanged(...args);
    return Comlink.proxy(res);
  };

  async getConfigFileSnap(sessionId: string, isTemplate: boolean): Promise<Snapshot> {
    const fs = await getEasyFs();
    const filename = isTemplate ? `${sessionId}.config-template.json` : `${sessionId}.config.json`;
    try {
      const statResult = await fs.stat(filename);
      if (statResult.isFile) {
        return {mtime: statResult.lastModified, size: statResult.size};
      }
      return null;
    } catch {
      return null;
    }
  }

  clearPageHistory = Comlink.clone(clearPageHistory);

  async ping() {
    return true;
  }
}
