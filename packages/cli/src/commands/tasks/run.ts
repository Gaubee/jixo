import {FileEntry, findChangedFilesSinceTime, Ignore, normalizeFilePath, walkFiles} from "@gaubee/nodekit";
import {iter_map_not_null} from "@gaubee/util";
import fs from "node:fs";
import path from "node:path";
import {loadConfig} from "../../config.js";
import {loadJixoEnv} from "../../env.js";
import {resolveAiTasks} from "../../helper/resolve-ai-tasks.js";
import {runAiTask} from "./run-ai-task.js";

export const run = async (
  _cwd: string,
  options: {
    nameFilter: string[];
    dirFilter: string[];
    force?: boolean;
    loopTimes?: number;
  },
) => {
  const cwd = normalizeFilePath(_cwd);
  const config = await loadConfig(cwd);

  const nameMatcher = options.nameFilter.length ? new Ignore(options.nameFilter, cwd) : {isMatch: () => true};
  const dirMatcher = options.dirFilter.length ? new Ignore(options.dirFilter, cwd) : {isMatch: () => true};
  const cwdIgnoreFilepath = path.join(cwd, ".gitignore");
  const ignore = [".git"];
  if (fs.existsSync(cwdIgnoreFilepath)) {
    ignore.push(...fs.readFileSync(cwdIgnoreFilepath, "utf-8").split("\n"));
  }
  const exitedTasks = new Set<string>();

  let {force = false} = options;
  const {loopTimes: MAX_LOOP_TIMES = Infinity} = options;
  let currentTimes = 1;
  let retryTimes = 0;
  const MAX_RETRY_TIMES = 3;
  while (currentTimes <= MAX_LOOP_TIMES) {
    const ai_tasks = resolveAiTasks(cwd, config.tasks);

    const allFiles = [...walkFiles(cwd, {ignore})];
    let allDone = true;

    try {
      for (const ai_task of ai_tasks) {
        // 如果进度已经满了，并且没有任何依赖文件的变更，那么跳过这个任务
        if (!force) {
          if (ai_task.log.preProgress >= 1) {
            continue;
          }
        }
        if (exitedTasks.has(ai_task.name)) {
          continue;
        }

        const {dirs: task_dirs} = ai_task;
        if (!task_dirs.some((dir) => dirMatcher.isMatch(dir))) {
          continue;
        }
        if (!nameMatcher.isMatch(ai_task.name)) {
          continue;
        }
        const isCwdTask = cwd === task_dirs[0] && task_dirs.length === 1;

        const changedFiles = (await findChangedFilesSinceTime(ai_task.log.preUpdateTime, cwd)) ?? allFiles;

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

        /// 只要有一个任务执行了，那么allDone就要标记成false，进入下一次循环来判断
        allDone = false;
        await runAiTask(ai_task, currentTimes, task_allFiles, task_changedFiles);

        if (ai_task.exitCode != null) {
          exitedTasks.add(ai_task.name);
        }
      }
    } catch (e) {
      console.error(e);
      // 遇到异常，那么重试
      if (retryTimes < MAX_RETRY_TIMES) {
        retryTimes += 1;
        continue;
      } else {
        break;
      }
    }
    // force 只能生效一次，避免无限循环
    force = false;
    currentTimes += 1;
    /// 成功一次后，retry计数就重制
    retryTimes = 0;

    /// 如果没有任务执行了，那么退出循环
    if (allDone) {
      break;
    }
  }
};
