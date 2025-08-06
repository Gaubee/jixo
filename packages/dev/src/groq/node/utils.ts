import path from "node:path";
import {createRunCodeInBrowser} from "../common/eval.js";
import {createRunFetchInBrowser} from "../common/fetch.js";
import type {Task} from "../common/types.js";
import {NodeFsDuplex} from "../fs-duplex/node.js";
import {superjson} from "../fs-duplex/superjson.js";
import {findActiveGroqSession} from "./session.js";

import Debug from "debug";
export const debug = Debug("jixo:groq");

/**
 * The options for creating a task channel with a browser tab.
 */
export interface RunTaskOptions<T extends Task> {
  dir: string;
  initialTask: T;
}

/**
 * Establishes a communication channel for a task with an active browser tab
 * using the new fs-duplex protocol (dual-file, heartbeat).
 */
async function runTaskInBrowser<T extends Task>(options: RunTaskOptions<T>): Promise<NodeFsDuplex<T, "initiator">> {
  const {dir, initialTask} = options;

  const absoluteDir = path.resolve(dir);
  const session = await findActiveGroqSession(absoluteDir);

  const taskFilepathPrefix = path.join(absoluteDir, `${session.windowId}.${initialTask.type}-${initialTask.taskId}.groq-task`);

  const duplex = new NodeFsDuplex<T, "initiator">("initiator", superjson, taskFilepathPrefix);

  await duplex.start();
  duplex.init(initialTask);

  return duplex;
}

export type TaskRunner = typeof runTaskInBrowser;

// --- Compose the final evaler object ---
export const evaler = {
  runCodeInBrowser: createRunCodeInBrowser(runTaskInBrowser),
  runFetchInBrowser: createRunFetchInBrowser(runTaskInBrowser),
};
