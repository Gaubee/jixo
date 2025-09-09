import {junHistoryLogic} from "@jixo/jun";
import {z} from "zod/v4";

export const name = "shellHistory";

export const description = "列出所有由jun执行过的任务历史记录，包括已完成和正在运行的。";

export const paramsSchema = z.object({}).describe("此工具没有参数。");

/**
 * 调用 @jixo/jun 的 junHistoryLogic 来获取所有任务历史。
 * @returns 一个包含所有任务历史的对象
 */
export const functionCall = async (_args: z.infer<typeof paramsSchema>) => {
  console.log(`Executing jun history logic`);

  const history = await junHistoryLogic();

  return history;
};

// JIXO_CODER_EOF
