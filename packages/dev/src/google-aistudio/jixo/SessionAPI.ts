import {createAcontext} from "@gaubee/node";
import type {AgentMetadata} from "@jixo/dev/browser";
import {Comlink} from "@jixo/dev/comlink";
import path from "path";
import {globFilesWithParams} from "../../gen-prompt/replacers/file-replacer.js";
import {genPageConfig} from "../node/config.js";
import {doGoogleAiStudioAutomation} from "../node/index.js";

// --- API: Node.js -> Web-Isolated ---
// This is the interface for the API that the frontend will implement and pass to the backend.
// We define it here to have a contract. It will be implemented on the client side.
export interface UIApi {
  renderJob(
    jobId: string,
    componentName: string,
    props: any,
  ): Promise<{
    success: boolean;
    error?: string;
    result?: any;
  }>;
}

export const UIApiContext = createAcontext<Comlink.Remote<UIApi>>("UIApi");

// --- API: Web-Isolated -> Node.js ---
export class SessionAPI {
  #dir: string | PromiseWithResolvers<string> = Promise.withResolvers<string>();
  #changeWitter: PromiseWithResolvers<string> | null = null;
  #signalController: AbortController | null = null;
  #uiApi;

  constructor(
    readonly nid: number,
    readonly sessionId: string,
    uiApiProxy: Comlink.Remote<UIApi>,
  ) {
    this.#uiApi = uiApiProxy; //Comlink.wrap (createEndp ws)
  }
  async setWorkDir(workDir: string) {
    if (typeof this.#dir === "object") {
      this.#dir.resolve(workDir);
    }
    if (workDir !== this.#dir) {
      this.#dir = workDir;
      this.#changeWitter?.resolve(workDir);
      this.#changeWitter = null;

      const controller = new AbortController();
      this.#signalController?.abort("workDir changed.");
      this.#signalController = controller;

      // Start the main automation service, watching the workspace.
      void UIApiContext.run(this.#uiApi, () => {
        return doGoogleAiStudioAutomation({dir: workDir, watch: true, signal: controller.signal}).catch(() => {});
      });
    }
  }
  async whenWorkDirChanged() {
    if (this.#changeWitter == null) {
      this.#changeWitter = Promise.withResolvers();
    }
    return this.#changeWitter.promise;
  }
  async getWorkDir() {
    if (typeof this.#dir === "object") {
      return this.#dir.promise;
    }
    return this.#dir;
  }
  async hasWorkDir() {
    return typeof this.#dir === "string";
  }
  async unsetWorkDir() {
    if (typeof this.#dir === "string") {
      this.#dir = Promise.withResolvers();
      this.#signalController?.abort("workDir unset.");
      this.#signalController = null;
    }
  }
  async generateConfigFromMetadata(metadata: AgentMetadata) {
    const config = await genPageConfig(metadata);
    return config;
  }
  async resolvePaths(paths: string[]): Promise<string[]> {
    const workDir = await this.getWorkDir();
    return paths.map((p) => path.resolve(workDir, p));
  }
  async globFiles(patterns: string[]): Promise<string[]> {
    const workDir = await this.getWorkDir();
    const allFiles = await Promise.all(patterns.map((p) => globFilesWithParams(p, workDir, {})));
    return [...new Set(allFiles.flat())];
  }
  async ping() {
    return "pong";
  }
}
