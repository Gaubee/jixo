import {delay, getEasyFs, styles} from "../../google-aistudio/browser/utils.js";
import {doEval} from "../common/eval.js";
import {doFetch} from "../common/fetch.js";
import type {TaskHandler} from "../common/task-handlers.js";
import type {Task} from "../common/types.js";
import {BrowserFsDuplex, type FsDuplexBrowserHelper} from "../fs-duplex/browser.js";
import {superjson} from "../fs-duplex/superjson.js";
import {initializeSession} from "./session.js";
import {getWindowId} from "./utils.js";

// Map task types to their corresponding handler functions.
const taskHandlers: {[key in Task["type"]]: TaskHandler<any>} = {
  eval: doEval,
  fetch: doFetch,
};

// --- Browser-side FsDuplex Helper Implementation ---
class FsHelper implements FsDuplexBrowserHelper {
  constructor(private fs: import("../../google-aistudio/browser/utils.js").EasyFS) {}
  async getFileHandle(filename: string): Promise<FileSystemFileHandle> {
    const dirHandle = (this.fs as any)._dirHandle as FileSystemDirectoryHandle;
    if (!dirHandle) {
      throw new Error("EasyFS is not initialized with a DirectoryHandle.");
    }
    return dirHandle.getFileHandle(filename, {create: true});
  }
  // This is required by the FsDuplex.destroy() method
  async removeFile(filename: string): Promise<void> {
    const dirHandle = (this.fs as any)._dirHandle as FileSystemDirectoryHandle;
    if (!dirHandle) {
      throw new Error("EasyFS is not initialized with a DirectoryHandle.");
    }
    await dirHandle.removeEntry(filename);
  }
}

// Use a Map to keep track of active FsDuplex instances by their filename prefix.
const activeDuplexes = new Map<string, BrowserFsDuplex<Task, "handler">>();

async function handleTask(fs: import("../../google-aistudio/browser/utils.js").EasyFS, filenamePrefix: string, initialContent: string) {
  let duplex: BrowserFsDuplex<Task, "handler"> | undefined;
  try {
    console.log(`Processing task for prefix: ${filenamePrefix}`);
    const initialTask: Task = superjson.parse(initialContent);

    const handler = taskHandlers[initialTask.type];
    if (!handler) {
      console.warn(`No handler for task type: ${initialTask.type}`);
      // Clean up the initial task file if no handler is found.
      await fs.rm(`${filenamePrefix}.in.jsonl`);
      return;
    }

    const helper = new FsHelper(fs);
    duplex = new BrowserFsDuplex<Task, "handler">("handler", superjson, filenamePrefix, helper);
    activeDuplexes.set(filenamePrefix, duplex);

    duplex.onClose.on((reason) => {
      console.log(`Connection for ${filenamePrefix} closed. Reason: ${reason}.`);
      activeDuplexes.delete(filenamePrefix);
      // No need to manually delete files here, destroy() handles it.
    });

    duplex.onError.on((err) => {
      console.error(`Error on duplex for ${filenamePrefix}:`, err);
      activeDuplexes.delete(filenamePrefix);
    });

    await duplex.start();

    // The handler is a simple async function that takes control.
    // Its completion signifies the end of the task.
    await handler(duplex, initialTask);

    // Once the handler is done, gracefully close the connection.
    duplex.close("done");
  } catch (e) {
    console.error(`Error processing task ${filenamePrefix}:`, e);
    // If an error occurs, ensure we attempt to clean up the duplex.
  } finally {
    // The finally block is CRITICAL to prevent resource leaks.
    if (duplex && duplex.currentState !== "closed") {
      // If the duplex wasn't closed gracefully, destroy it to clean up files.
      await duplex.destroy();
    }
    activeDuplexes.delete(filenamePrefix);
  }
}

const processTasks = async () => {
  const fs = await getEasyFs();
  const windowId = getWindowId();

  // Find initial task files created by Node.js
  const taskFiles = (await fs.readdir("")).filter((name) => name.startsWith(`${windowId}.`) && name.endsWith(".groq-task.in.jsonl"));

  for (const filename of taskFiles) {
    const filenamePrefix = filename.replace(/\.in\.jsonl$/, "");
    if (activeDuplexes.has(filenamePrefix)) {
      continue; // This task is already being handled.
    }

    // Mark as active immediately by adding a placeholder to the map.
    // This is a simple lock to prevent race conditions.
    activeDuplexes.set(filenamePrefix, null as any);

    try {
      const content = await fs.readFileText(filename);
      // We only read the first line because that's the initial task payload.
      // The rest of the file is handled by the FsDuplex log reader.
      const firstLine = content.split("\n")[0];

      if (firstLine) {
        // Start handling the task, but don't wait for it to complete.
        void handleTask(fs, filenamePrefix, firstLine);
      } else {
        // If the file is empty, it's an anomaly. Clean it up.
        activeDuplexes.delete(filenamePrefix);
        await fs.rm(filename);
      }
    } catch (e) {
      console.error(`Failed to start task for ${filenamePrefix}`, e);
      activeDuplexes.delete(filenamePrefix);
    }
  }
};

export const sync = async (fps = 1) => {
  await initializeSession();
  console.log("%c会话初始化成功！", styles.success);
  while (true) {
    await processTasks();
    await delay(1000 / fps);
  }
};
