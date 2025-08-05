import {delay, getEasyFs, styles} from "../../google-aistudio/browser/utils.js";
import {superjson} from "../common/coding.js";
import {doEval} from "../common/eval.js";
import {doEventStream} from "../common/eventStream.js";
import {doFetch} from "../common/fetch.js";
import type {Task} from "../common/types.js";
import {BrowserFsDuplex} from "./fs-duplex.js";
import {initializeSession} from "./session.js";
import {getWindowId} from "./utils.js";

const taskHandlers = {
  eval: doEval,
  fetch: doFetch,
  "event-stream": doEventStream,
};

// Use a Set to keep track of filenames currently being processed by a duplex channel.
const active_duplexes = new Set<string>();

async function handleTask(duplex: BrowserFsDuplex<Task>) {
  const filename = duplex.filename; // A bit of a hack to get the filename for the active_duplexes set
  try {
    console.log(`Processing task: ${filename}`);

    // Wait for the first data chunk (the initial task)
    const initialTask = await duplex.nextData();
    if (initialTask.done) {
      return;
    }

    const handler = taskHandlers[initialTask.type];
    if (!handler) {
      console.warn(`No handler for task type: ${initialTask.type}`);
      return;
    }

    // The core processing loop driven by the handler's async generator
    for await (const {output, changed} of handler(initialTask as any)) {
      if (changed) {
        // If the handler produced a change, write it back.
        await duplex.write(output);
      } else {
        // If no change, it means the handler is waiting for an update from the other side.
        // We wait for the next data event from the duplex channel.
        const nextTask = await duplex.nextData();
        // The handler's next iteration will receive this updated task.
        Object.assign(output, nextTask);
      }
      if (output.done) {
        break; // Exit the loop if the task is marked as done.
      }
    }
    console.log(`Task completed: ${filename}`);
  } catch (e) {
    console.error(`Error processing task ${filename}:`, e);
    // Try to notify the other side about the error
    await duplex.write({status: "rejected", result: e, done: true} as any).catch(() => {});
  } finally {
    // Cleanup
    active_duplexes.delete(filename);
    await duplex.destroy();
  }
}

const processTasks = async () => {
  const fs = await getEasyFs();
  const windowId = getWindowId();
  if (!windowId) return;

  const taskFiles = (await fs.readdir("")).filter((name) => name.startsWith(`${windowId}.`) && name.endsWith(".groq-task.json"));

  for (const filename of taskFiles) {
    if (active_duplexes.has(filename)) {
      // Already being processed, skip.
      continue;
    }

    // Mark as active
    active_duplexes.add(filename);

    // Create a new duplex channel for this task file.
    const duplex = new BrowserFsDuplex(superjson, fs, filename);

    // Start listening for file changes.
    duplex.start();

    // Handle the task logic in a non-blocking way.
    void handleTask(duplex);
  }
};

export const sync = async (fps = 3) => {
  // First, initialize the session to get headers.
  await initializeSession();
  console.log("%c会话初始化成功！", styles.success);

  // Then, start the task processing loop.
  while (true) {
    await processTasks();
    await delay(1000 / fps);
  }
};
