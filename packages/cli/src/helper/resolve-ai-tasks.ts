import {matter, readMarkdown, walkFiles} from "@gaubee/nodekit";
import path from "node:path";
import {match, P} from "ts-pattern";
import {type JixoConfig} from "../config";

/**
 * 将 config.tasks 字段转化成具体的 ai-tasks 信息
 * @param dir
 * @param config_tasks
 * @returns
 */
export const resolveAiTasks = (dir: string, config_tasks: JixoConfig["tasks"]) => {
  const config_tasks_arr = Array.isArray(config_tasks) ? config_tasks : [config_tasks];
  const tasks: {name: string; data: {[key: string]: any}; content: string}[] = [];

  for (const config_task of config_tasks_arr) {
    match(config_task)
      .with(
        {
          type: "dir",
          dirname: P.string.select(),
        },
        (dirname) => {
          for (const entry of walkFiles(path.resolve(dir, dirname), {
            matchFile(entry) {
              return entry.name.endsWith(".task.md");
            },
          })) {
            tasks.push({
              ...readMarkdown(entry.name),
              name: entry.name.slice(0, -".task.md".length),
            });
          }
        },
      )
      .with(
        {
          type: "file",
          filename: P.string.select("filename"),
          name: P.string.select("name").optional(),
        },
        (m) => {
          tasks.push({
            ...readMarkdown(m.filename),
            name: m.name ?? m.filename.slice(0, -".task.md".length),
          });
        },
      )
      .with(P.string.select(), (mdContents) => {
        for (const mdContent of mdContents) {
          tasks.push({...matter(mdContent), name: `${tasks.length + 1}`});
        }
      })
      .with(
        {
          type: "prompt",
          content: P.string.select("content"),
          name: P.string.select("name").optional(),
        },
        (m) => {
          tasks.push({...matter(m.content), name: m.name ?? `${tasks.length + 1}`});
        },
      )
      .exhaustive();
  }
  return tasks;
};

export type AiTask = ReturnType<typeof resolveAiTasks>[number];
