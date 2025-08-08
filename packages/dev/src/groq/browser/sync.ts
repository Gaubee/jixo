import type {EasyFS} from "../../google-aistudio/browser/utils.js";
import {delay, getEasyFs, styles} from "../../google-aistudio/browser/utils.js";
import {doEval} from "../common/eval.js";
import {doFetch} from "../common/fetch.js";
import type {Task} from "../common/types.js";
import {BrowserFsDuplex, type FsDuplexBrowserHelper} from "../fs-duplex/browser.js";
import {superjson} from "../fs-duplex/superjson.js";
import {initializeSession} from "./session.js";
import {getWindowId} from "./utils.js";

// The handlers are now simple async functions that take the duplex and initial task.
const taskHandlers: {
  [K in Task["type"]]: (duplex: BrowserFsDuplex<Extract<Task, {type: K}>, "handler">, initialTask: Extract<Task, {type: K}>) => Promise<void>;
} = {
  eval: doEval,
  fetch: doFetch,
};

// --- Browser-side FsDuplex Helper Implementation ---
class FsHelper implements FsDuplexBrowserHelper {
  constructor(private fs: EasyFS) {}
  async getFileHandle(filename: string): Promise<FileSystemFileHandle> {
    const dirHandle = (this.fs as any)._dirHandle as FileSystemDirectoryHandle;
    if (!dirHandle) {
      throw new Error("EasyFS is not initialized with a DirectoryHandle.");
    }
    return dirHandle.getFileHandle(filename, {create: true});
  }
  // The removeFile method is part of the FsDuplexBrowserHelper interface
  // and is used by duplex.destroy()
  async removeFile(filename: string): Promise<void> {
    const dirHandle = (this.fs as any)._dirHandle as FileSystemDirectoryHandle;
    if (!dirHandle) {
      throw new Error("EasyFS is not initialized with a DirectoryHandle.");
    }
    await dirHandle.removeEntry(filename);
  }
}

// Use a Set to keep track of filename prefixes currently being processed.
const active_tasks = new Set<string>();

async function handleTask(fs: EasyFS, filenamePrefix: string, initialContent: string) {
  const initialTask: Task = superjson.parse(initialContent);
  const handler = taskHandlers[initialTask.type];

  if (!handler) {
    console.warn(`No handler for task type: ${initialTask.type}`);
    active_tasks.delete(filenamePrefix); // Clean up immediately
    // Also remove the task file to prevent re-processing
    await fs.rm(`${filenamePrefix}.in.jsonl`).catch(() => {});
    return;
  }

  const helper = new FsHelper(fs);
  const duplex = new BrowserFsDuplex("handler", superjson, filenamePrefix, helper);

  try {
    console.log(`Processing task for prefix: ${filenamePrefix}`);

    // The most reliable way to clean up is to listen to the duplex's own close event.
    duplex.onClose.on((reason) => {
      console.log(`Connection for ${filenamePrefix} closed. Reason: ${reason}. Cleaning up from active_tasks.`);
      active_tasks.delete(filenamePrefix);
    });

    duplex.onError.on((err) => {
      console.error(`Error on duplex for ${filenamePrefix}:`, err);
    });

    // Start listening for messages
    await duplex.start();

    // The core of the new paradigm:
    // Call the handler and let it manage the entire lifecycle of the task.
    // The handler is an async function that will complete when the task is done.
    await handler(duplex as any, initialTask as any);
  } catch (e) {
    console.error(`Error processing task ${filenamePrefix}:`, e);
    // If an error occurs outside the handler (e.g., during duplex creation),
    // ensure the duplex is closed and cleaned up.
    if (duplex.currentState !== "closed") {
      duplex.close("error");
    }
  } finally {
    // CRITICAL: Ensure all duplex resources (timers, files) are cleaned up
    // regardless of how the handler finishes.
    await duplex.destroy();
    console.log(`Task ${filenamePrefix} finished and resources destroyed.`);
  }
}

const processTasks = async () => {
  const fs = await getEasyFs();
  const windowId = getWindowId();

  const taskFiles = (await fs.readdir("")).filter((name) => name.startsWith(`${windowId}.`) && name.endsWith(".groq-task.in.jsonl"));

  for (const filename of taskFiles) {
    const filenamePrefix = filename.replace(/\.in\.jsonl$/, "");
    if (active_tasks.has(filenamePrefix)) {
      continue;
    }
    active_tasks.add(filenamePrefix);

    const content = await fs.readFileText(filename);
    const firstLine = content.split("\n")[0];

    if (firstLine) {
      // No 'await' here, handleTask runs in the background for each task
      void handleTask(fs, filenamePrefix, firstLine);
    } else {
      // If the task file is empty, clean it up.
      active_tasks.delete(filenamePrefix);
      fs.rm(filename).catch(() => {});
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
