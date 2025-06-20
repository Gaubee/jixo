import {map_get_or_put_async} from "@gaubee/util";
import matter from "gray-matter";
import fs from "node:fs";
import fsp from "node:fs/promises";
import {LogFileSchema, type JobInfoData, type LogFileData} from "../entities.js";
import {calcContentHash, ensureJixoDirsExist, getCacheFilePath, getLogFilePath} from "./internal.js";
import {LogManager} from "./logManager.js";
import {serializeLogFile} from "./logSerializer.js";
import {logParserAgent} from "./parserAgent.js";

class LogManagerFactory {
  private instances = new Map<string, LogManager>();

  private async _createManagerInstance(jobName: string, info: JobInfoData): Promise<LogManager> {
    await ensureJixoDirsExist(info.workDir);
    const logFilePath = getLogFilePath(info.workDir, jobName);
    let initialData: LogFileData;

    if (!fs.existsSync(logFilePath)) {
      initialData = {
        info,
        roadmap: [],
        workLog: [],
      };
      const content = serializeLogFile(initialData);
      await fsp.writeFile(logFilePath, content, "utf-8");
      const hash = calcContentHash(content);
      await fsp.writeFile(getCacheFilePath(info.workDir, hash), JSON.stringify(initialData, null, 2), "utf-8");
    } else {
      const content = await fsp.readFile(logFilePath, "utf-8");
      const hash = calcContentHash(content);
      const cachePath = getCacheFilePath(info.workDir, hash);

      try {
        const cachedData = await fsp.readFile(cachePath, "utf-8");
        initialData = LogFileSchema.parse(JSON.parse(cachedData));
      } catch {
        try {
          const parsedFile = matter(content);
          const result = await logParserAgent.generate(content, {output: LogFileSchema});
          initialData = result.object;
        } catch (e) {
          console.warn("Failed to parse log file with gray-matter, falling back to AI parser.", e);
          const result = await logParserAgent.generate(content, {output: LogFileSchema});
          initialData = result.object;
        }
        await fsp.writeFile(cachePath, JSON.stringify(initialData, null, 2));
      }
    }

    return new LogManager(jobName, initialData, logParserAgent);
  }

  public getOrCreate(jobName: string, info: JobInfoData): Promise<LogManager> {
    return map_get_or_put_async(this.instances, jobName, async () => {
      const manager = await this._createManagerInstance(jobName, info);
      this.instances.set(jobName, manager);
      return manager;
    });
  }

  public async createIsolated(jobName: string, info: JobInfoData): Promise<LogManager> {
    return this._createManagerInstance(jobName, info);
  }
}

export const logManagerFactory = new LogManagerFactory();
