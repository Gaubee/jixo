import {randomUUID} from "node:crypto";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {beforeEach, describe, expect, it, vi} from "vitest";
import {getLogFilePath} from "./internal.js";
import {WorkspaceManager} from "./workspaceManager.js";

const workspaceDir = path.join(os.tmpdir(), "jixo-tests", randomUUID());
let workspaceManager: WorkspaceManager;

beforeEach(async () => {
  const {ensureJixoDirsExist} = await import("./internal.js");
  await fsp.rm(workspaceDir, {recursive: true, force: true});
  await ensureJixoDirsExist(workspaceDir);

  workspaceManager = new WorkspaceManager(workspaceDir);
});

describe("WorkspaceManager", () => {
  it("should create a new job with default directory", async () => {
    const job = await workspaceManager.createJob("default-dir-job", "Goal for default dir");
    expect(job.jobDir).toBe(workspaceDir);
    const jobInfo = job.getJobInfo();
    expect(jobInfo.jobName).toBe("default-dir-job");
  });

  it("should create a job with a specific subdirectory", async () => {
    const job = await workspaceManager.createJob("subdir-job", "Goal for subdir", "my-job-subdir");
    const expectedDir = path.join(workspaceDir, "my-job-subdir");
    expect(job.jobDir).toBe(expectedDir);
  });

  it("should create a job with its name as the subdirectory", async () => {
    const job = await workspaceManager.createJob("named-dir-job", "Goal for named dir", true);
    const expectedDir = path.join(workspaceDir, "named-dir-job");
    expect(job.jobDir).toBe(expectedDir);
  });

  it("should list all created jobs", async () => {
    await workspaceManager.createJob("job1", "Goal 1");
    await workspaceManager.createJob("job2", "Goal 2");

    const jobs = await workspaceManager.listJobs();
    expect(jobs).toHaveLength(2);
    expect(jobs).toContainEqual({jobName: "job1", jobGoal: "Goal 1"});
    expect(jobs).toContainEqual({jobName: "job2", jobGoal: "Goal 2"});
  });

  describe("updateJobDir", () => {
    it("should update jobDir without moving files (default mode)", async () => {
      const job = await workspaceManager.createJob("pointer-test", "A job for pointer change");
      const oldDir = job.jobDir;
      const newDir = path.join(workspaceDir, "new-logical-dir");
      await fsp.mkdir(newDir, {recursive: true});

      await workspaceManager.updateJobDir("pointer-test", newDir);

      await expect(fsp.access(oldDir)).resolves.toBeUndefined();
      const jobInfo = job.getJobInfo();
      expect(jobInfo.jobDir).toBe(newDir);

      const logFilePath = getLogFilePath(workspaceDir, "pointer-test");
      await expect(fsp.access(logFilePath)).resolves.toBeUndefined();
    });

    it("should move the directory and update the log file (rename mode)", async () => {
      const jobDirName = "job-to-move";
      const job = await workspaceManager.createJob("rename-test", "A job to rename", jobDirName);
      const oldDir = workspaceManager.resolveJobDir("rename-test", jobDirName);
      const newDir = path.join(workspaceDir, "renamed-job-dir");

      await fsp.mkdir(oldDir, {recursive: true});
      await fsp.writeFile(path.join(oldDir, "test.txt"), "hello");

      await workspaceManager.updateJobDir("rename-test", newDir, true);

      await expect(fsp.access(oldDir)).rejects.toThrow(/ENOENT/);
      await expect(fsp.access(path.join(newDir, "test.txt"))).resolves.toBeUndefined();

      const updatedJobInfo = job.getJobInfo();
      expect(updatedJobInfo.jobDir).toBe(newDir);

      const reloadedJob = await workspaceManager.getJobLogManager("rename-test");
      expect(reloadedJob.jobDir).toBe(newDir);
    });

    it("should throw an error if renaming to a directory that already exists", async () => {
      await workspaceManager.createJob("error-test", "Job for error handling", "error-dir");
      const newDir = path.join(workspaceDir, "existing-dir");
      await fsp.mkdir(newDir, {recursive: true});

      await expect(workspaceManager.updateJobDir("error-test", newDir, true)).rejects.toThrow(`Target directory already exists: ${newDir}`);
    });

    it("emits a jobDirChanged event on successful update", async () => {
      const job = await workspaceManager.createJob("event-test", "A job for event testing", true);
      const oldDir = job.jobDir;
      const newDir = path.join(workspaceDir, "event-job-dir");
      const listener = vi.fn();

      job.onJobDirChanged.watch(listener);

      await workspaceManager.updateJobDir("event-test", newDir, true);

      expect(listener).toHaveBeenCalledOnce();
      expect(listener).toHaveBeenCalledWith({oldDir, newDir});
    });
  });
});
