import {Agent} from "@mastra/core/agent";
import fs from "node:fs";
import fsp from "node:fs/promises";
import {LogFileSchema, type LogFileData} from "../entities.js";
import {thinkModel} from "../llm/index.js";
import {calcContentHash, ensureJixoDirsExist, getCacheFilePath, getLogFilePath} from "./internal.js";
import {LogManager} from "./logManager.js";
import {serializeLogFile} from "./logSerializer.js";

class LogManagerFactory {
  private instances = new Map<string, LogManager>();
  private parserAgent;

  constructor() {
    this.parserAgent = new Agent({
      name: "ParserAgent_Internal_Factory",
      instructions: `You are a highly-structured data parser. Your task is to receive a Markdown file content with YAML front matter and convert it into a valid JSON object that strictly adheres to the provided Zod schema. You must extract the front matter fields AND parse the 'Roadmap' and 'Work Log' sections. The 'Roadmap' is a nested Markdown checklist. Your output MUST be ONLY the JSON object, without any surrounding text or markdown backticks.`,
      model: thinkModel,
    });
  }

  private async _createManagerInstance(jobName: string, env: Record<string, string> = {}): Promise<LogManager> {
    await ensureJixoDirsExist();
    const logFilePath = getLogFilePath(jobName);
    let content: string;
    let initialData: LogFileData;

    if (!fs.existsSync(logFilePath)) {
      initialData = {
        title: "_undefined_",
        progress: "0%",
        env,
        roadmap: [],
        workLog: [],
      };
      content = serializeLogFile(initialData);
      await fsp.writeFile(logFilePath, content, "utf-8");
      const hash = calcContentHash(content);
      await fsp.writeFile(getCacheFilePath(hash), JSON.stringify(initialData, null, 2), "utf-8");
    } else {
      content = await fsp.readFile(logFilePath, "utf-8");
      const hash = calcContentHash(content);
      const cachePath = getCacheFilePath(hash);
      try {
        const cachedData = await fsp.readFile(cachePath, "utf-8");
        initialData = LogFileSchema.parse(JSON.parse(cachedData));
      } catch {
        const result = await this.parserAgent.generate(content, {output: LogFileSchema});
        initialData = result.object;
        await fsp.writeFile(cachePath, JSON.stringify(initialData, null, 2));
      }
    }

    return new LogManager(jobName, initialData, this.parserAgent);
  }

  /**
   * Gets a cached LogManager instance for a job, or creates a new one if it doesn't exist.
   * This method ensures that for any given jobName, only one LogManager instance is active.
   * @param jobName The name of the job.
   * @param env Optional environment variables to set during initialization if the log file is new.
   * @returns A promise that resolves to the singleton LogManager instance for the specified job.
   */
  public async getOrCreate(jobName: string, env: Record<string, string> = {}): Promise<LogManager> {
    if (this.instances.has(jobName)) {
      return this.instances.get(jobName)!;
    }
    const manager = await this._createManagerInstance(jobName, env);
    this.instances.set(jobName, manager);
    return manager;
  }

  /**
   * Creates a new, isolated LogManager instance for a job, bypassing the cache.
   * This is useful for testing or scenarios requiring a completely fresh state.
   * @param jobName The name of the job.
   * @param env Optional environment variables to set during initialization if the log file is new.
   * @returns A promise that resolves to a new, non-cached LogManager instance.
   */
  public async createIsolated(jobName: string, env: Record<string, string> = {}): Promise<LogManager> {
    return this._createManagerInstance(jobName, env);
  }
}

export const logManagerFactory = new LogManagerFactory();
