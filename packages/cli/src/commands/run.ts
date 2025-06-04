import {Ignore, normalizeFilePath} from "@gaubee/nodekit";
import path from "node:path";
import {loadConfig} from "../config";
import {findChangedFilesSinceCommit} from "../helper/find-changes";
import {resolveAiTasks} from "../helper/resolve-ai-tasks";

export const run = async (_cwd: string, options: {nameFilter: string[]; dirFilter: string[]}) => {
  const cwd = normalizeFilePath(_cwd);
  const config = await loadConfig(cwd);
  const ai_tasks = resolveAiTasks(cwd, config.tasks);
  const nameMatcher = options.nameFilter.length ? new Ignore(options.nameFilter, cwd) : {isMatch: () => true};
  const dirMatcher = options.dirFilter.length ? new Ignore(options.dirFilter, cwd) : {isMatch: () => true};

  const changedFiles = await findChangedFilesSinceCommit("@jixo", cwd);
  for (const ai_task of ai_tasks) {
    const {dir: _task_dir = cwd, agents = []} = ai_task.data;
    const task_dir = normalizeFilePath(path.resolve(cwd, _task_dir));
    if (!dirMatcher.isMatch(task_dir)) {
      continue;
    }
    if (!nameMatcher.isMatch(ai_task.name)) {
      continue;
    }
    let task_changedFiles = changedFiles;
    if (task_dir !== cwd) {
      task_changedFiles = task_changedFiles.filter((file) => file.path.startsWith(task_dir + "/"));
    }
    console.log(task_dir, agents, ai_task.content, task_changedFiles);
  }
};

const runAiTask = ()=>{
    
}

// const getChangedFiles = async (cwd: string, task_dir: string) => {
//   const $ = $$({cwd: cwd,stdio: "pipe"});
//   if ((await $('git rev-parse --is-inside-work-tree',)).stdout !== "true") {
//     return [...walkFiles(task_dir)];
//   }

//   return new Promise<string[]>((resolve, reject) => {
//     exec(`git diff --name-only --diff-filter=ACMRTUXB ${cwd}`, (err, stdout) => {
//       if (err) {
//         reject(err);
//       } else {
//         resolve(stdout.split("\n"));
//       }
//     });
//   });
// };
