import {z} from "zod/v4-mini";
import type {TaskRunner} from "../node/utils.js";
import type {TaskHandler} from "./task-handlers.js";

// 1. Zod 定义 (The Contract) - no changes
export const zEvalTask = z.object({
  type: z.literal("eval"),
  taskId: z.string(),
  code: z.string(),
  status: z.enum(["initial", "pending", "fulfilled", "rejected"]),
  result: z.any(),
  done: z.boolean(),
});
export type EvalTask = z.output<typeof zEvalTask>;

// 2. Browser 状态处理函数 (The Browser-side Logic)
export const doEval: TaskHandler<EvalTask> = async (duplex, initialTask) => {
  const output = {...initialTask};
  try {
    // Directly evaluate the code.
    const result = await (async () => eval(output.code))();
    output.status = "fulfilled";
    output.result = result;
  } catch (e) {
    output.status = "rejected";
    // Ensure the error is serializable by superjson
    output.result = e instanceof Error ? {message: e.message, name: e.name, stack: e.stack} : e;
  } finally {
    output.done = true;
    // Send the final state back to Node.js
    duplex.sendData(output);
  }
};

// 3. Node 状态处理函数 (The Node-side Initiator Factory) - no changes yet
export const createRunCodeInBrowser = (runner: TaskRunner) => {
  return async (dir: string, code: string): Promise<any> => {
    const initialTask: EvalTask = {
      type: "eval",
      taskId: crypto.randomUUID(),
      code,
      status: "initial",
      result: null,
      done: false,
    };

    const duplex = await runner<EvalTask>({dir, initialTask});

    return new Promise((resolve, reject) => {
      const offData = duplex.onData.on((task) => {
        if (task.done) {
          cleanup();
          if (task.status === "rejected") {
            reject(task.result);
          } else {
            resolve(task.result);
          }
          duplex.close();
        }
      });

      const offClose = duplex.onClose.on((reason) => {
        cleanup();
        reject(new Error(`Task ${initialTask.taskId} closed unexpectedly. Reason: ${reason}`));
      });

      const cleanup = () => {
        offData();
        offClose();
      };
    });
  };
};
