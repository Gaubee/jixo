import path from "node:path";
import {superjson} from "../common/coding.js";
import {createRunCodeInBrowser} from "../common/eval.js";
import {createRunEventStreamInBrowser} from "../common/eventStream.js";
import {createRunFetchInBrowser} from "../common/fetch.js";
import type {FsDuplex} from "../common/fs-duplex.js";
import type {Task} from "../common/types.js";
import {NodeFsDuplex} from "./fs-duplex.js";
import {findActiveGroqSession} from "./session.js";

/**
 * The options for creating a task channel with a browser tab.
 */
export interface RunTaskOptions<T extends Task> {
  dir: string;
  initialTask: T;
}

/**
 * Establishes a communication channel for a task with an active browser tab.
 */
async function runTaskInBrowser<T extends Task>(options: RunTaskOptions<T>): Promise<FsDuplex<T>> {
  const {dir, initialTask} = options;

  // Use the robust session management to find an active session
  const session = await findActiveGroqSession(dir);

  const taskFilepath = path.join(dir, `${session.windowId}.${initialTask.type}-${initialTask.taskId}.groq-task.json`);

  // Create the Node.js side of the duplex channel with the initial task data.
  const duplex = new NodeFsDuplex<T>(superjson, taskFilepath, initialTask);

  // Start the duplex channel's polling mechanism.
  duplex.start();

  return duplex;
}

export type TaskRunner = typeof runTaskInBrowser;

// --- Compose the final evaler object ---
// Inject the `runTaskInBrowser` (our transport layer factory)
export const evaler = {
  runCodeInBrowser: createRunCodeInBrowser(runTaskInBrowser),
  runFetchInBrowser: createRunFetchInBrowser(runTaskInBrowser),
  runEventStreamInBrowser: createRunEventStreamInBrowser(runTaskInBrowser),
};
