import {cosmiconfig} from "cosmiconfig";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import {type JobInfoData} from "../entities.js";
import {ensureJixoDirsExist, getLogFilePath} from "./internal.js";
import {LogManager} from "./logManager.js";
import {logManagerFactory} from "./logManagerFactory.js";

async function loadJixoConfig(dir: string) {
  const explorer = cosmiconfig("jixo");
  const result = await explorer.search(dir);
  return result?.config || {};
}

class WorkspaceManager {
  private workspaceDir: string;
  private jixoDir: string;
  private config: Promise<any>;

  constructor(workspaceDir: string) {
    this.workspaceDir = path.resolve(workspaceDir);
    this.jixoDir = path.join(this.workspaceDir, ".jixo");
    this.config = loadJixoConfig(this.workspaceDir);

    ensureJixoDirsExist(this.workspaceDir);
  }

  async listJobs(): Promise<{jobName: string; jobGoal: string}[]> {
    const files = await fsp.readdir(this.jixoDir);
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
    // This reuses the isolated creation logic, ensuring we get a fresh instance
    // based on the current file state.
    const logFilePath = getLogFilePath(this.workspaceDir, jobName);
    if (!fs.existsSync(logFilePath)) {
      throw new Error(`Job '${jobName}' not found.`);
    }
    // We need a dummy jobGoal to pass, but it will be overwritten by data from the log file.
    return logManagerFactory.createIsolated({jobName, jobGoal: "", workDir: this.workspaceDir});
  }

  async getJobLogFile(jobName: string): Promise<import("../entities.js").LogFileData> {
    const logManager = await this.getJobLogManager(jobName);
    return logManager.getLogFile();
  }

  /**
   *
   * @param jobName
   * @param jobGoal
   * @param dirname if false, uses the workspaceDir, if true, uses jobName as dirname, otherwise uses the provided dirname.
   * @returns
   */
  async createJob(jobName: string, jobGoal: string, dirname: string | boolean = false): Promise<LogManager> {
    const jobInfo: JobInfoData = {
      jobName,
      jobGoal,
      workDir: dirname === false ? this.workspaceDir : path.join(this.workspaceDir, dirname === true ? jobName : dirname),
    };
    // createIsolated handles file creation if it doesn't exist.
    return logManagerFactory.createIsolated(jobInfo);
  }
}

export const workspaceManager = new WorkspaceManager(process.cwd());
