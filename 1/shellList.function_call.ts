import {junLsLogic} from "jsr:@jixo/jun";
import z from "npm:zod";

export const name = "shellList";

export const description = "列出当前所有由jun管理的正在运行的后台任务。";

export const paramsSchema = z.object({}).describe("此工具没有参数。");

/**
 * 调用 @jixo/jun 的 junLsLogic 来列出正在运行的任务。
 * @returns 一个包含正在运行任务列表的对象
 */
export const functionCall = async (_args: z.infer<typeof paramsSchema>) => {
  console.log(`Executing jun ls logic`);

  const runningTasks = await junLsLogic();

  return {
    status: "SUCCESS",
    running_tasks: runningTasks,
  };
};

// JIXO_CODER_EOF
