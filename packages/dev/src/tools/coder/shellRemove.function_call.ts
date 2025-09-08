import {junRmLogic} from "@jixo/jun";
import { z } from "zod/v4";

export const name = "shellRemove";

export const description = "清理jun的历史记录。可以指定pid，也可以进行批量清理。";

export const paramsSchema = z
  .object({
    pids: z.array(z.number().int().positive()).optional().describe("要移除的具体任务PID列表。"),
    all: z.boolean().optional().describe("如果为true，则移除所有已结束的任务。"),
    auto: z.boolean().optional().describe("如果为true，则自动清理，仅保留最近10条和所有正在运行的任务。"),
  })
  .refine((data) => data.pids || data.all || data.auto, {
    message: "At least one of pids, all, or auto must be specified.",
  });

/**
 * 调用 @jixo/jun 的 junRmLogic 来清理历史记录。
 * @param args - 符合paramsSchema的参数
 * @returns 一个报告操作结果的对象
 */
export const functionCall = async (args: z.infer<typeof paramsSchema>) => {
  console.log(`Executing jun rm logic with args:`, args);

  const {removed, skipped} = await junRmLogic({
    pids: args.pids,
    all: args.all,
    auto: args.auto,
  });

  return {
    status: "SUCCESS",
    removed_pids: removed,
    skipped_pids: skipped,
  };
};

// JIXO_CODER_EOF
