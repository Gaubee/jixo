import {FileEntry, Ignore, normalizeFilePath, walkFiles} from "@gaubee/nodekit";
import {iter_map_not_null} from "@gaubee/util";
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

  const allFiles = [...walkFiles(cwd)];
  const changedFiles = await findChangedFilesSinceCommit("@jixo", cwd);
  //   const run_tasks: Array<Func> = [];
  for (const ai_task of ai_tasks) {
    const {dir: task_dir} = ai_task;
    if (!dirMatcher.isMatch(task_dir)) {
      continue;
    }
    if (!nameMatcher.isMatch(ai_task.name)) {
      continue;
    }

    const task_changedFiles =
      cwd === task_dir
        ? changedFiles
        : iter_map_not_null(changedFiles, (file) => {
            if (file.path.startsWith(task_dir + "/")) {
              return new FileEntry(file.path, {cwd: task_dir, state: file.stats});
            }
          });

    const task_allFiles = cwd === task_dir ? allFiles : [...walkFiles(task_dir)];

    loadJixoEnv(cwd);
    await runAiTask(ai_task, task_allFiles, task_changedFiles);
  }
};
