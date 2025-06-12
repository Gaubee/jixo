import {matter, normalizeFilePath, readMarkdown, walkFiles, writeMarkdown} from "@gaubee/nodekit";
import {str_trim_indent} from "@gaubee/util";
import fs from "node:fs";
import path from "node:path";
import {match, P} from "ts-pattern";
import {uuidv7} from "uuidv7";
import z from "zod";
import {type JixoConfig} from "../config.js";
import {parseProgress} from "./parse-progress.js";

const process_runner_uuid_prefix = uuidv7();

/**
 * 将 config.tasks 字段转化成具体的 ai-tasks 信息
 * @param cwd
 * @param config_tasks
 * @returns
 */
export const resolveAiTasks = (cwd: string, config_tasks: JixoConfig["tasks"], current_job_loop_count: number) => {
  const config_tasks_arr = Array.isArray(config_tasks) ? config_tasks : [config_tasks];
  type TaskBase = {
    data: {[key: string]: any};
    content: string;
  };
  type AiTask = TaskBase &
    Readonly<{
      runner: string;
      jobName: string;
      loopCount: number;
      filepath: string;
      exitCode: number | null;
      exitReason: string;
      exit: (code: number, reason: string) => void;

      cwd: string;
      dirs: string[];
      agents: string[];
      model: string;
      startTime: string;
      maxTurns: number;
      otherRunners: string[];

      log: Readonly<{
        name: string;
        filepath: string;
        content: string;
        data: {[key: string]: any};
        createTime: string;
        preUpdateTime: string;
        preProgress: number;
      }>;
      reloadLog: () => void;
    }>;
  const tasks: AiTask[] = [];
  const addTask = (
    ai_task: TaskBase,
    options: {
      filepath?: string;
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

    const job_name = inner_task_name || options.defaultName;
    const useLog = ai_task.data.useLog || job_name;

    const log = {
      name: useLog,
      filepath: path.join(cwd, `.jixo/${useLog}.log.md`),
      content: "",
      data: {} as {[key: string]: any},
      get createTime(): string {
        return log.data.createTime ?? startTime;
      },
      get preUpdateTime(): string {
        return log.data.updateTime ?? startTime;
      },
      get preProgress(): number {
        return parseProgress(log.data.progress);
      },
    } satisfies AiTask["log"];
    const reloadLog = () => {
      log.content = fs.existsSync(log.filepath) ? fs.readFileSync(log.filepath, "utf-8").trim() : "";
      if (log.content === "") {
        writeMarkdown(
          log.filepath,
          str_trim_indent(`
        ## 工作计划
        
        <!--待定-->

        ---

        ## 工作日志

        <!--暂无-->
        `),
          {
            title: "_待定_",
            createTime: new Date().toISOString(),
            updateTime: new Date().toISOString(),
            progress: "0%",
          },
        );
        log.content = fs.readFileSync(log.filepath, "utf-8");
      }
      log.data = matter(log.content).data;
    };
    reloadLog();
    const startTime = new Date().toISOString();
    const runner_id = `${job_name}-${process_runner_uuid_prefix}-${current_job_loop_count.toString().padStart(3, "0")}`;

    const task_process = {
      code: null as number | null,
      reason: "",
      exit(code: number, reason: string) {
        if (task_process.code) {
          return;
        }
        task_process.code = code;
        task_process.reason = reason;
      },
    };

    tasks.push({
      ...ai_task,
      jobName: job_name,
      loopCount: current_job_loop_count,
      runner: runner_id,
      filepath: options.filepath ?? path.join(cwd, `.jixo/${job_name}.job.md`),
      cwd: cwd,
      dirs: task_dir,
      agents: match(z.union([z.string(), z.string().array()]).safeParse(ai_task.data.agents))
        .with({success: true, data: P.select()}, (agents) => {
          return Array.isArray(agents) ? agents : agents.split(/\s+/);
        })
        .otherwise(() => []),
      maxTurns: 40,
      otherRunners: [],
      model: match(z.string().safeParse(ai_task.data.model))
        .with({success: true, data: P.select()}, (model) => model)
        .otherwise(() => ""),
      startTime: startTime,
      reloadLog: reloadLog,
      log: log,

      get exitCode() {
        return task_process.code;
      },
      get exitReason() {
        return task_process.reason;
      },
      exit(code, reason) {
        task_process.exit(code, reason);
      },
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
              return entry.name.endsWith(".job.md");
            },
          })) {
            addTask(readMarkdown(entry.path), {
              filepath: entry.path,
              defaultName: entry.name.slice(0, -".job.md".length),
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
            filepath: m.filename,
            defaultName: m.name ?? m.filename.slice(0, -".job.md".length),
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
