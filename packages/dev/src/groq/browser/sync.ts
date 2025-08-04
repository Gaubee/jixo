import {delay, getEasyFs, styles} from "../../google-aistudio/browser/utils.js";
import {doEval} from "../common/eval.js";
import {doEventStream} from "../common/eventStream.js";
import {doFetch} from "../common/fetch.js";
import {zTask} from "../common/types.js";
import {superjson} from "../common/coding.js";
import {initializeSession} from "./session.js";
import {getWindowId} from "./utils.js";

const taskHandlers = {
  eval: doEval,
  fetch: doFetch,
  "event-stream": doEventStream,
};
const processing_locks: Record<string, boolean | void> = {};
const processTasks = async () => {
  const fs = await getEasyFs();
  const windowId = getWindowId();
  if (!windowId) return;

  const taskFiles = (await fs.readdir("")).filter((name) => name.startsWith(`${windowId}.`) && name.endsWith(".groq-task.json"));
  if (taskFiles.length) {
    console.log("taskFiles", taskFiles);
  }
  for (const filename of taskFiles) {
    void (async () => {
      if (processing_locks[`processing_${filename}`]) return;
      try {
        console.log("start task", filename);
        debugger;

        processing_locks[`processing_${filename}`] = true;
        const getTaskObj = async () => {
          try {
            const content = await fs.readFileText(filename);
            const task = zTask.safeParse(superjson.parse(content));
            return task.data;
          } catch {}
        };
        let task = await getTaskObj();

        if (!task || task.done) {
          return;
        }

        const handler = taskHandlers[task.type];
        if (!handler) {
          console.warn(`No handler for task type: ${task.type}`);
          return;
        }

        console.log(`Processing task: ${task.taskId} of type ${task.type}`);
        for await (const {output, changed} of handler(task as any)) {
          if (changed) {
            await fs.writeFile(filename, superjson.stringify(output));
          } else {
            const newTask = await getTaskObj();
            if (newTask) {
              task = newTask;
            }
            if (task?.done) {
              return;
            }
            /// 更新
            Object.assign(output, task);
          }
        }
        console.log(`Task completed: ${task.taskId}`);
      } catch (e) {
        console.error(`Error processing task file ${filename}:`, e);
      } finally {
        delete processing_locks[`processing_${filename}`];
      }
    })();
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
