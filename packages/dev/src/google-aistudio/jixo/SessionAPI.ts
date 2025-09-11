import path from "path";
import {globFilesWithParams} from "../../gen-prompt/replacers/file-replacer.js";
import {Comlink} from "../../lib/comlink.js";
import type {AgentMetadata} from "../browser/index.js";
import {genPageConfig} from "../node/config.js";
import {doGoogleAiStudioAutomation} from "../node/index.js";

// --- Session-level Request Handler ---

export class SessionAPI {
  constructor(
    readonly nid: number,
    readonly sessionId: string,
  ) {}
  #dir: string | PromiseWithResolvers<string> = Promise.withResolvers<string>();
  #changeWitter: PromiseWithResolvers<string> | null = null;
  #signalController: AbortController | null = null;

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
      void doGoogleAiStudioAutomation({dir: workDir, watch: true, signal: controller.signal}).catch(() => {});
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
  generateConfigFromMetadata = Comlink.clone(async (metadata: AgentMetadata) => {
    const config = await genPageConfig(metadata);
    return config;
  });
  resolvePaths = Comlink.clone(async (paths: string[]): Promise<string[]> => {
    const workDir = await this.getWorkDir();
    return paths.map((p) => path.resolve(workDir, p));
  });
  globFiles = Comlink.clone(async (patterns: string[]): Promise<string[]> => {
    const workDir = await this.getWorkDir();
    const allFiles = await Promise.all(patterns.map((p) => globFilesWithParams(p, workDir, {})));
    return [...new Set(allFiles.flat())];
  });
  async ping() {
    return "pong";
  }
}
