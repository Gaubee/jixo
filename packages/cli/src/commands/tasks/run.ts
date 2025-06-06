import {FileEntry, Ignore, normalizeFilePath, walkFiles} from "@gaubee/nodekit";
import {iter_map_not_null} from "@gaubee/util";
import fs from "node:fs";
import path from "node:path";
import {loadConfig} from "../../config.js";
import {loadJixoEnv} from "../../env.js";
import {findChangedFilesSinceCommit} from "../../helper/find-changes.js";
import {resolveAiTasks} from "../../helper/resolve-ai-tasks.js";
import {runAiTask} from "./run-ai-task.js";

export const run = async (_cwd: string, options: {nameFilter: string[]; dirFilter: string[]}) => {
  const cwd = normalizeFilePath(_cwd);
  const config = await loadConfig(cwd);
  const ai_tasks = resolveAiTasks(cwd, config.tasks);
  const nameMatcher = options.nameFilter.length ? new Ignore(options.nameFilter, cwd) : {isMatch: () => true};
  const dirMatcher = options.dirFilter.length ? new Ignore(options.dirFilter, cwd) : {isMatch: () => true};
  const cwdIgnoreFilepath = path.join(cwd, ".gitignore");
  const ignore = [".git"];
  if (fs.existsSync(cwdIgnoreFilepath)) {
    ignore.push(...fs.readFileSync(cwdIgnoreFilepath, "utf-8").split("\n"));
  }

  const allFiles = [...walkFiles(cwd, {ignore})];
  const changedFiles = (await findChangedFilesSinceCommit("@jixo", cwd)).filter((file) => {
    return file.path.startsWith(cwd + "/");
  });

  //   const run_tasks: Array<Func> = [];
  for (const ai_task of ai_tasks) {
    const {dirs: task_dirs} = ai_task;
    if (!task_dirs.some((dir) => dirMatcher.isMatch(dir))) {
      continue;
    }
    if (!nameMatcher.isMatch(ai_task.name)) {
      continue;
    }
    const isCwdTask = cwd === task_dirs[0] && task_dirs.length === 1;

    const task_changedFiles = isCwdTask
      ? {[cwd]: changedFiles}
      : task_dirs.reduce(
          (tree, task_dir) => {
            tree[task_dir] = iter_map_not_null(changedFiles, (file) => {
              if (file.path.startsWith(task_dirs + "/")) {
                return new FileEntry(file.path, {cwd: task_dir, state: file.stats});
              }
            });
            return tree;
          },
          {} as Record<string, FileEntry[]>,
        );

    const task_allFiles = isCwdTask ? allFiles : task_dirs.map((task_dir) => [...walkFiles(task_dir, {ignore})]).flat();

    loadJixoEnv(cwd);
    await runAiTask(ai_task, task_allFiles, task_changedFiles);
  }
};
