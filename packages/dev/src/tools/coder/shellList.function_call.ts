import {junLsLogic} from "@jixo/jun";
import {z} from "zod/v4";
import {toParamsSchema} from "../helper.js";

export const name = "shellList";

export const description = "列出当前所有由jun管理的正在运行的后台任务。";

export const zParams = z.object({});
export const paramsSchema = toParamsSchema(zParams);

/**
 * 调用 @jixo/jun 的 junLsLogic 来列出正在运行的任务。
 * @returns 一个包含正在运行任务列表的对象
 */
export const functionCall = async (_args: z.infer<typeof zParams>) => {
  console.log(`Executing jun ls logic`);

  const runningTasks = await junLsLogic();

  return runningTasks;
};
