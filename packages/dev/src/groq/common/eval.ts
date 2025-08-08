import {z} from "zod/v4-mini";
import type {FsDuplex} from "../fs-duplex/common.js";
import type {TaskRunner} from "../node/utils.js";
import {waitNextTask} from "./utils.js";

// 1. Zod 定义 (The Contract) - NO CHANGE
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
export async function doEval(duplex: FsDuplex<EvalTask, "handler">, initialTask: EvalTask): Promise<void> {
  const output: EvalTask = {...initialTask, status: "pending"};
  try {
    // We don't need to send a 'pending' update. Just execute the code.
    const result = await (async () => eval(output.code))();
    output.status = "fulfilled";
    output.result = result;
  } catch (e) {
    output.status = "rejected";
    output.result = e instanceof Error ? {message: e.message, name: e.name, stack: e.stack} : e;
  } finally {
    output.done = true;
    // Send the final result and close the connection.
    duplex.sendData(output);
    duplex.close("done");
  }
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

    try {
      // Wait for the final task object that has `done: true`.
      const finalTask = await waitNextTask(duplex, {
        filter: (task) => task.done,
        timeout: 30000, // 30 second timeout for eval
      });

      if (finalTask.status === "rejected") {
        throw finalTask.result;
      } else {
        return finalTask.result;
      }
    } finally {
      // Ensure the duplex is closed on the Node side as well.
      duplex.close();
    }
  };
};
