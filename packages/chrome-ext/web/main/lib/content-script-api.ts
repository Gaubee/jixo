import type {PageConfig} from "@jixo/dev/browser";
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
import {getWorkspaceHandle, storeWorkspaceHandle} from "./workspace.ts";

// --- API Definition ---
export class MainContentScriptAPI {
  constructor(readonly sessionId: string) {}
  #syncAbortController: AbortController | null = null;

  async getWorkspaceHandleName(): Promise<string | null> {
    const handle = await getWorkspaceHandle(this.sessionId);
    await restoreDirHandle(handle);
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
    try {
      const newHandle = await this.#requestWorkspaceHandle();
      // 恢复同步
      if (startSync ?? isSyncing) {
        await this.startSync();
      }
      return newHandle.name;
    } catch {
      return null;
    }
  }

  startSync = Comlink.clone(async (): Promise<{status: "SYNC_STARTED" | "ERROR"; message?: string}> => {
    this.#syncAbortController?.abort("restart");
    this.#syncAbortController = null;
    try {
      const handle = await this.#requestWorkspaceHandle();
      if (!handle) throw new Error("Workspace not available for sync.");
      console.log(`JIXO BROWSER: Starting sync with workspace '${handle.name}'...`);

      this.#syncAbortController = new AbortController();
      const signal = this.#syncAbortController.signal;
      void syncOutput(signal);
      void syncInput(signal);
      return {status: "SYNC_STARTED"};
    } catch (e) {
      this.#syncAbortController?.abort(e);
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

  async readConfigFile(sessionId: string): Promise<PageConfig | null> {
    try {
      const fs = await getEasyFs();
      const filename = `${sessionId}.config.json`;
      const content = await fs.readFileText(filename);
      return JSON.parse(content);
    } catch (error) {
      if (error instanceof Error && error.name === "NotFoundError") {
        return null;
      }
      throw error;
    }
  }

  async writeConfigFile(sessionId: string, configJson: string): Promise<void> {
    const fs = await getEasyFs();
    const filename = `${sessionId}.config.json`;
    await fs.writeFile(filename, configJson);
  }

  applyConfigFile = Comlink.clone(async (sessionId: string): Promise<{status: "SUCCESS" | "ERROR"; message?: string}> => {
    const config = await this.readConfigFile(sessionId);
    if (!config) {
      return {status: "ERROR", message: "Config file (config.json) not found."};
    }
    await this.#applyPageConfig(config);
    return {status: "SUCCESS"};
  });

  // Expose the new file watching utility
  whenFileChanged = (...args: Parameters<typeof whenFileChanged>) => {
    const res = whenFileChanged(...args);
    return Comlink.proxy(res);
  };

  clearPageHistory = Comlink.clone(clearPageHistory);

  async ping() {
    return true;
  }
}
