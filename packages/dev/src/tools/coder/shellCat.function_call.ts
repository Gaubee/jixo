import {junCatLogic} from "@jixo/jun";
import { z } from "zod/v4";

export const name = "shellCat";

export const description = "获取一个或多个指定pid任务的详细信息和完整的stdio日志。";

export const paramsSchema = z.object({
  pids: z.array(z.number().int().positive()).min(1).describe("要获取日志的任务PID列表。"),
});

/**
 * 调用 @jixo/jun 的 junCatLogic 来获取任务日志。
 * @param args - 符合paramsSchema的参数
 * @returns 一个包含任务详细日志的对象
 */
export const functionCall = async (args: z.infer<typeof paramsSchema>) => {
  console.log(`Executing jun cat logic for pids: ${args.pids.join(", ")}`);

  const {success, failed} = await junCatLogic(args.pids);

  return {
    status: "SUCCESS",
    tasks: success,
    failed_pids: failed,
  };
};
