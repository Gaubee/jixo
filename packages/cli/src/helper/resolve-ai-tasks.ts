import {matter, normalizeFilePath, readMarkdown, walkFiles, writeMarkdown} from "@gaubee/nodekit";
import fs from "node:fs";
import path from "node:path";
import {match, P} from "ts-pattern";
import z from "zod";
import {type JixoConfig} from "../config.js";

/**
 * 将 config.tasks 字段转化成具体的 ai-tasks 信息
 * @param cwd
 * @param config_tasks
 * @returns
 */
export const resolveAiTasks = (cwd: string, config_tasks: JixoConfig["tasks"]) => {
  const config_tasks_arr = Array.isArray(config_tasks) ? config_tasks : [config_tasks];
  type TaskBase = {
    data: {[key: string]: any};
    content: string;
  };
  type AiTask = TaskBase & {
    name: string;
    cwd: string;
    dir: string;
    agents: string[];
    model: string;
    memory: string;
  };
  const tasks: AiTask[] = [];
  const addTask = (
    ai_task: TaskBase,
    options: {
      defaultName: string;
    },
  ) => {
    const {name: inner_task_name, dir: _task_dir = cwd} = ai_task.data;
    const task_dir = normalizeFilePath(path.resolve(cwd, _task_dir));

    const task_name = inner_task_name || options.defaultName;
    const memory_filepath = path.join(cwd, `.jixo/${task_name}.memory.md`);
    if (!fs.existsSync(memory_filepath)) {
      writeMarkdown(memory_filepath, ``, {
        createTime: new Date().toISOString(),
        updateTime: new Date().toISOString(),
      });
    } else {
      const memory = readMarkdown(memory_filepath);
      writeMarkdown(memory_filepath, memory.content, {
        ...memory.data,
        updateTime: new Date().toISOString(),
      });
    }
    tasks.push({
      ...ai_task,
      name: task_name,
      cwd: cwd,
      dir: task_dir,
      agents: match(z.union([z.string(), z.string().array()]).safeParse(ai_task.data.agents))
        .with({success: true, data: P.select()}, (agents) => {
          return Array.isArray(agents) ? agents : agents.split(/\s+/);
        })
        .otherwise(() => []),
      model: match(z.string().safeParse(ai_task.data.model))
        .with({success: true, data: P.select()}, (model) => model)
        .otherwise(() => ""),
      memory: fs.readFileSync(memory_filepath, "utf-8"),
    });
  };

  for (const config_task of config_tasks_arr) {
    match(config_task)
      .with(
        {
          type: "dir",
          dirname: P.string.select(),
        },
        (dirname) => {
          for (const entry of walkFiles(path.resolve(cwd, dirname), {
            matchFile(entry) {
              return entry.name.endsWith(".task.md");
            },
          })) {
            addTask(readMarkdown(entry.path), {
              defaultName: entry.name.slice(0, -".task.md".length),
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
          addTask(readMarkdown(m.filename), {
            defaultName: m.name ?? m.filename.slice(0, -".task.md".length),
          });
        },
      )
      .with(P.string.select(), (mdContent) => {
        addTask(matter(mdContent), {
          defaultName: `${tasks.length + 1}`,
        });
      })
      .with(
        {
          type: "prompt",
          content: P.string.select("content"),
          name: P.string.select("name").optional(),
        },
        (m) => {
          addTask(matter(m.content), {
            defaultName: m.name ?? `${tasks.length + 1}`,
          });
        },
      )
      .exhaustive();
  }
  return tasks;
};

export type AiTask = ReturnType<typeof resolveAiTasks>[number];
