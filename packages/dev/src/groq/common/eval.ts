import {z} from "zod/v4-mini";
import type {TaskRunner} from "../node/utils.js";

// 1. Zod 定义 (The Contract)
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
export async function* doEval(input: EvalTask): AsyncGenerator<{changed: boolean; output: EvalTask}, void, EvalTask | undefined> {
  const output = {...input};
  try {
    const result = await (async () => eval(output.code))();
    output.status = "fulfilled";
    output.result = result;
  } catch (e) {
    output.status = "rejected";
    output.result = e;
  } finally {
    output.done = true;
  }
  yield {changed: true, output};
}

// 3. Node 状态处理函数 (The Node-side Initiator Factory)
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
