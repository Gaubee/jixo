import {delay} from "@gaubee/util";
import {readFile, rm, stat, writeFile} from "node:fs/promises";
import path from "node:path";
import {superjson} from "../common/coding.js";
import {createRunCodeInBrowser} from "../common/eval.js";
import {createRunEventStreamInBrowser} from "../common/eventStream.js";
import {createRunFetchInBrowser} from "../common/fetch.js";
import type {Task} from "../common/types.js";

import Debug from "debug";
import {findActiveGroqSession} from "./session.js";
export const debug = Debug("jixo:groq");

export interface RunTaskOptions<T extends Task> {
  dir: string;
  initialTask?: T;
  update?: {taskId: string; type: string; payload: Partial<T>};
  poll?: {taskId: string; type: string};
  waitUntil: (task: T) => boolean;
}

async function runTaskInBrowser<T extends Task>(options: RunTaskOptions<T>): Promise<T> {
  const {dir, initialTask, update, poll, waitUntil} = options;

  const session = await findActiveGroqSession(dir);
  if (!session) throw new Error("No active browser session found in browser.");

  let taskFilepath: string;
  let taskId: string;

  if (initialTask) {
    taskId = initialTask.taskId;
    taskFilepath = path.join(dir, `${session.windowId}.${initialTask.type}-${taskId}.groq-task.json`);
    await writeFile(taskFilepath, superjson.stringify(initialTask));
  } else if (update || poll) {
    const info = update || poll!;
    taskId = info.taskId;
    taskFilepath = path.join(dir, `${session.windowId}.${info.type}-${taskId}.groq-task.json`);
    if (update) {
      const currentContent = await readFile(taskFilepath, "utf-8");
      const currentTask = superjson.parse(currentContent);
      // FIX: Use Object.assign for type-safe merging with generics.
      const updatedTask = Object.assign({}, currentTask, update.payload);
      await writeFile(taskFilepath, superjson.stringify(updatedTask));
    }
  } else {
    throw new Error("Either initialTask, update, or poll must be provided.");
  }

  let lastMtime = (await stat(taskFilepath)).mtimeMs;

  const destroy = async () => {
    console.log("QAQ will rm", taskFilepath);
    delay(10_000).then(() => {
      rm(taskFilepath, {force: true}).catch(() => {});
    });
  };

  const MAX_ENOENT_TIMES = 3;
  let enoent_times = 0;

  try {
    while (true) {
      try {
        const stats = await stat(taskFilepath);
        enoent_times = 0;
        if (stats.mtimeMs === lastMtime) {
          await delay(50);
          continue;
        }
        lastMtime = stats.mtimeMs;

        const taskContent = await readFile(taskFilepath, "utf-8");
        if (!taskContent) continue;

        const task: T = superjson.parse(taskContent);

        if (waitUntil(task)) {
          if (task.status === "rejected") {
            throw task.result || new Error(`Task ${taskId} failed with no result.`);
          }
          if (task.done) {
            await destroy();
          }
          return task;
        }
      } catch (error: any) {
        if (error.code === "ENOENT") {
          enoent_times += 1;
          console.log("QAQ ENOENT", enoent_times);
          if (enoent_times >= MAX_ENOENT_TIMES) {
            break;
          } else {
            await delay(200);
          }
        }
        if (error instanceof SyntaxError) {
          await delay(50);
          continue;
        }
        throw error;
      }
    }
  } catch (e) {
    await destroy();
    throw e;
  }
  throw new Error(`Task ${taskId} ended unexpectedly.`);
}

export type TaskRunner = typeof runTaskInBrowser;

// --- Compose the final evaler object ---
// Here we inject the `runTaskInBrowser` (our transport layer)
// into the creators from the `common` modules.

export const evaler = {
  runCodeInBrowser: createRunCodeInBrowser(runTaskInBrowser),
  runFetchInBrowser: createRunFetchInBrowser(runTaskInBrowser),
  runEventStreamInBrowser: createRunEventStreamInBrowser(runTaskInBrowser),
};
