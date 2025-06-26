import {type PromiseMaybe, map_get_or_put_async} from "@gaubee/util";
import {cosmiconfig} from "cosmiconfig";
import fs, {existsSync} from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import {match, P} from "ts-pattern";
import {type JobInfoData, type LogFileData, LogFileSchema} from "../entities.js";
import {calcContentHash, ensureJixoDirsExist, getCacheFilePath, getLogFilePath} from "./internal.js";
import {LogManager} from "./logManager.js";
import {serializeLogFile} from "./logSerializer.js";
import {logParserAgent} from "./parserAgent.js";

async function loadJixoConfig(dir: string) {
  const explorer = cosmiconfig("jixo");
  const result = await explorer.search(dir);
  return result?.config || {};
}

export class WorkspaceManager {
  private workspaceDir: string;
  private jixoDir: string;
  private config: Promise<any>;
  private instances = new Map<string, LogManager>();

  constructor(workspaceDir: string) {
    this.workspaceDir = path.resolve(workspaceDir);
    this.jixoDir = path.join(this.workspaceDir, ".jixo");
    this.config = loadJixoConfig(this.workspaceDir);

    ensureJixoDirsExist(this.workspaceDir);
  }

  private async _createManagerInstance(jobName: string, info: JobInfoData): Promise<LogManager> {
    // The physical log file is always in the workspace's .jixo dir.
    const logFilePath = getLogFilePath(this.workspaceDir, jobName);
    await ensureJixoDirsExist(this.workspaceDir);
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
      await fsp.writeFile(getCacheFilePath(this.workspaceDir, hash), JSON.stringify(initialData, null, 2), "utf-8");
    } else {
      const content = await fsp.readFile(logFilePath, "utf-8");
      const hash = calcContentHash(content);
      const cachePath = getCacheFilePath(this.workspaceDir, hash);

      try {
        const cachedData = await fsp.readFile(cachePath, "utf-8");
        initialData = LogFileSchema.parse(JSON.parse(cachedData));
      } catch {
        try {
          const result = await logParserAgent.generate(content, {output: LogFileSchema});
          initialData = result.object;
        } catch (e) {
          console.warn("Failed to parse log file with AI parser.", e);
          throw new Error("Log file parsing failed.");
        }
        await fsp.writeFile(cachePath, JSON.stringify(initialData, null, 2));
      }
    }

    return new LogManager(jobName, initialData, logParserAgent, this.workspaceDir);
  }

  public getOrCreateJobManager(jobName: string, info: JobInfoData | (() => PromiseMaybe<JobInfoData>)): Promise<LogManager> {
    return map_get_or_put_async(this.instances, jobName, async () => {
      const resolvedInfo = typeof info === "function" ? await info() : info;
      const manager = await this._createManagerInstance(jobName, resolvedInfo);
      this.instances.set(jobName, manager);
      return manager;
    });
  }

  public async createJob(jobName: string, jobGoal: string, jobDir?: string | boolean): Promise<LogManager> {
    const jobInfo: JobInfoData = {
      jobName,
      jobGoal,
      jobDir: this.resolveJobDir(jobName, jobDir),
    };
    return this.getOrCreateJobManager(jobName, jobInfo);
  }

  public async updateJobDir(jobName: string, newJobDir: string, renameOriginDir: boolean = false): Promise<LogManager> {
    const logManager = await this.getJobLogManager(jobName);
    const oldJobDir = logManager.jobDir;
    const resolvedNewDir = this.resolveJobDir(jobName, newJobDir);

    if (oldJobDir === resolvedNewDir) {
      return logManager; // No change needed
    }

    if (renameOriginDir) {
      if (existsSync(resolvedNewDir)) {
        throw new Error(`Target directory already exists: ${resolvedNewDir}`);
      }
      if (existsSync(oldJobDir)) {
        await fsp.rename(oldJobDir, resolvedNewDir);
      } else {
        // If the old dir doesn't exist, just ensure the new one does
        await fsp.mkdir(resolvedNewDir, {recursive: true});
      }
    } else {
      // In pointer-change mode, just ensure the target directory exists.
      await fsp.mkdir(resolvedNewDir, {recursive: true});
    }

    // This internal method updates the in-memory state and persists the .log.md file
    await logManager.updateJobInfo({jobDir: resolvedNewDir});

    return logManager;
  }

  /**
   * Resolves the working directory for a job based on the provided job name and directory setting.
   */
  resolveJobDir(jobName: string, jobDir: boolean | string = false): string {
    return match(jobDir)
      .with(true, () => path.join(this.workspaceDir, jobName))
      .with(P.string, (dirname) => path.resolve(this.workspaceDir, dirname))
      .otherwise(() => this.workspaceDir);
  }

  async listJobs(): Promise<{jobName: string; jobGoal: string}[]> {
    const files = await fsp.readdir(this.jixoDir).catch(() => []);
    const jobFiles = files.filter((file) => file.endsWith(".log.md"));

    const jobs = await Promise.all(
      jobFiles.map(async (file) => {
        const jobName = path.basename(file, ".log.md");
        try {
          const logManager = await this.getJobLogManager(jobName);
          const {jobGoal} = logManager.getJobInfo();
          return {jobName, jobGoal};
        } catch (error) {
          console.error(`Failed to read job info for ${jobName}:`, error);
          return null;
        }
      }),
    );

    return jobs.filter(Boolean) as {jobName: string; jobGoal: string}[];
  }

  async getJobLogManager(jobName: string): Promise<LogManager> {
    const logFilePath = getLogFilePath(this.workspaceDir, jobName);
    if (!fs.existsSync(logFilePath)) {
      throw new Error(`Job '${jobName}' not found.`);
    }
    // Dummy goal, will be overwritten by reading the log file.
    // The jobDir is set to workspaceDir because we don't know the logical jobDir until we parse the file.
    return this.getOrCreateJobManager(jobName, {jobName, jobGoal: "", jobDir: this.workspaceDir});
  }

  async getJobLogFile(jobName: string): Promise<import("../entities.js").LogFileData> {
    const logManager = await this.getJobLogManager(jobName);
    return logManager.getLogFile();
  }
}
