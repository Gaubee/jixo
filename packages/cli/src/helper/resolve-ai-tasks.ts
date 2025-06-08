import {matter, normalizeFilePath, readMarkdown, walkFiles, writeMarkdown} from "@gaubee/nodekit";
import fs from "node:fs";
import path from "node:path";
import {match, P} from "ts-pattern";
import z from "zod";
import {type JixoConfig} from "../config.js";
import { str_trim_indent } from "@gaubee/util";

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
    dirs: string[];
    agents: string[];
    model: string;
    useMemory: string;
    useLog: string;
    log: string;
    startTime: string;
  };
  const tasks: AiTask[] = [];
  const addTask = (
    ai_task: TaskBase,
    options: {
      defaultName: string;
    },
  ) => {
    const {name: inner_task_name} = ai_task.data;

    const task_dir = match(z.union([z.string(), z.string().array()]).safeParse(ai_task.data.dirs ?? ai_task.data.dir))
      .with({success: true}, (it) => {
        const dirList = Array.isArray(it.data) ? it.data : [it.data];
        return dirList.map((dir) => normalizeFilePath(path.resolve(cwd, dir)));
      })
      .otherwise(() => []);
    if (task_dir.length === 0) {
      task_dir.push(cwd);
    }

    const task_name = inner_task_name || options.defaultName;
    const useMemory = ai_task.data.useMemory || task_name;
    const useLog = ai_task.data.useLog || task_name;

    const log_filepath = path.join(cwd, `.jixo/${useLog}.log.md`);
    if (!fs.existsSync(log_filepath)) {
      writeMarkdown(log_filepath, str_trim_indent(`
        ## 工作计划
        
        ---

        ## 工作日志
        `), {
        createTime: new Date().toISOString(),
        updateTime: new Date().toISOString(),
      });
    }

    tasks.push({
      ...ai_task,
      name: task_name,
      cwd: cwd,
      dirs: task_dir,
      agents: match(z.union([z.string(), z.string().array()]).safeParse(ai_task.data.agents))
        .with({success: true, data: P.select()}, (agents) => {
          return Array.isArray(agents) ? agents : agents.split(/\s+/);
        })
        .otherwise(() => []),
      model: match(z.string().safeParse(ai_task.data.model))
        .with({success: true, data: P.select()}, (model) => model)
        .otherwise(() => ""),
      useMemory,
      useLog,
      log: fs.readFileSync(log_filepath, "utf-8"),
      startTime: new Date().toISOString(),
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
