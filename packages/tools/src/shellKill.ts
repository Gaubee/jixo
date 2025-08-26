import {junKillLogic} from "jsr:@jixo/jun";
import z from "npm:zod";

export const name = "shellKill";

export const description = "停止一个或多个正在运行的后台任务。";

export const paramsSchema = z.object({
  pids: z.array(z.number().int().positive()).min(1).describe("要停止的后台任务PID列表。"),
});

/**
 * 调用 @jixo/jun 的 junKillLogic 来停止任务。
 * @param args - 符合paramsSchema的参数
 * @returns 一个报告操作结果的对象
 */
export const functionCall = async (args: z.infer<typeof paramsSchema>) => {
  console.log(`Executing jun kill logic for pids: ${args.pids.join(", ")}`);

  const {killedCount, failedPids} = await junKillLogic({pids: args.pids});

  return {
    status: "SUCCESS",
    killed_count: killedCount,
    failed_pids: failedPids,
  };
};

// JIXO_CODER_EOF
