import {Ignore, normalizeFilePath, walkFiles} from "@gaubee/nodekit";
import {loadConfig} from "../../config.js";
import {findChangedFilesSinceCommit} from "../../helper/find-changes.js";
import {resolveAiTasks} from "../../helper/resolve-ai-tasks.js";
import {runAiTask} from "../../helper/run-ai.js";

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
    console.log(ai_task, dirMatcher.isMatch(task_dir), nameMatcher.isMatch(ai_task.name));
    if (!dirMatcher.isMatch(task_dir)) {
      continue;
    }
    if (!nameMatcher.isMatch(ai_task.name)) {
      continue;
    }

    const task_changedFiles = changedFiles.filter((file) => file.path.startsWith(task_dir + "/"));
    // run_tasks.push(() => runAiTask(ai_task, task_changedFiles));
    await runAiTask(ai_task, allFiles, task_changedFiles);
  }
};
