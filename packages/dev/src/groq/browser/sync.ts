import type {EasyFS} from "../../google-aistudio/browser/utils.js";
import {delay, getEasyFs, styles} from "../../google-aistudio/browser/utils.js";
import {doEval} from "../common/eval.js";
import {doFetch} from "../common/fetch.js";
import type {Task} from "../common/types.js";
import {BrowserFsDuplex, type FsDuplexBrowserHelper} from "../fs-duplex/browser.js";
import {superjson} from "../fs-duplex/superjson.js";
import {initializeSession} from "./session.js";
import {getWindowId} from "./utils.js";

const taskHandlers = {
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
}

// Use a Set to keep track of filename prefixes currently being processed.
const active_tasks = new Set<string>();

async function handleTask(fs: EasyFS, filenamePrefix: string, initialContent: string) {
  try {
    console.log(`Processing task for prefix: ${filenamePrefix}`);
    const initialTask: Task = superjson.parse(initialContent);

    const handler = taskHandlers[initialTask.type];
    if (!handler) {
      console.warn(`No handler for task type: ${initialTask.type}`);
      return;
    }

    const helper = new FsHelper(fs);
    // Provide the explicit generic type <Task>
    const duplex = new BrowserFsDuplex<Task, "handler">("handler", superjson, filenamePrefix, helper);

    duplex.onClose.on((reason) => {
      console.log(`Connection for ${filenamePrefix} closed. Reason: ${reason}. Cleaning up.`);
      active_tasks.delete(filenamePrefix);
      fs.rm(`${filenamePrefix}.in.jsonl`).catch(() => {});
      fs.rm(`${filenamePrefix}.out.jsonl`).catch(() => {});
      fs.rm(`${filenamePrefix}.heartbeat.json`).catch(() => {});
    });

    duplex.onError.on((err) => {
      console.error(`Error on duplex for ${filenamePrefix}:`, err);
    });

    await duplex.start();

    const taskProcessor = handler(initialTask as any);

    // The first .next() call on a generator does not take an argument.
    let result = await taskProcessor.next();

    while (!result.done) {
      if (result.value) {
        const {output, changed} = result.value;
        if (changed) {
          duplex.sendData(output);
        }
        // Wait for the next update from Node.js
        const nextTask = await duplex.onData.once();
        result = await taskProcessor.next(nextTask);
      } else {
        // Should not happen if generator is well-behaved, but as a safeguard:
        const nextTask = await duplex.onData.once();
        result = await taskProcessor.next(nextTask);
      }
    }
    // Final value might need processing
    if (result.value) {
      const {output, changed} = result.value;
      if (changed) {
        duplex.sendData(output);
      }
    }

    duplex.close();
  } catch (e) {
    console.error(`Error processing task ${filenamePrefix}:`, e);
    active_tasks.delete(filenamePrefix);
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
      void handleTask(fs, filenamePrefix, firstLine);
    } else {
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
