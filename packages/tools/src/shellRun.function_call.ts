import {junRunLogic} from "jsr:@jixo/jun";
import type {FunctionCallFn} from "npm:@jixo/dev/google-aistudio";
import z from "npm:zod";

export const name = "shellRun";

export const description = "使用jun代理执行一个shell命令。这会将命令的执行和stdio持久化，并允许后台运行和后续查询。";

export const paramsSchema = z.object({
  command: z.string().describe("要执行的主命令。"),
  args: z.array(z.string()).optional().default([]).describe("命令的参数列表。"),
  background: z.boolean().optional().default(false).describe("是否在后台运行命令。如果为true，工具会立即返回pid而不会等待命令完成。"),
});

/**
 * 调用 @jixo/jun 的 junRunLogic 来执行命令。
 * @param args - 符合paramsSchema的参数
 * @returns 一个包含jun任务信息的对象
 */
export const functionCall: FunctionCallFn<z.infer<typeof paramsSchema>> = async (args) => {
  if (args.background) {
    // For background tasks, we capture the JSON output to get the PID.
    let pid = -1;
    let osPid = -1;
    const originalConsoleLog = console.log;
    let jsonOutput = "";
    console.log = (data) => {
      jsonOutput = data;
    }; // Hijack console.log

    try {
      await junRunLogic({
        command: args.command,
        commandArgs: args.args,
        background: true,
        json: true,
      });
      const parsed = JSON.parse(jsonOutput);
      pid = parsed.pid;
      osPid = parsed.osPid;
    } finally {
      console.log = originalConsoleLog; // Restore console.log
    }

    return {
      status: "STARTED_IN_BACKGROUND",
      pid: pid,
      osPid: osPid,
      command: args.command,
      args: args.args,
    };
  }

  // For foreground tasks, we wait for the result as before.
  const exitCode = await junRunLogic({
    command: args.command,
    commandArgs: args.args,
    background: false,
    json: false,
  });

  return {
    status: exitCode === 0 ? "COMPLETED" : "ERROR",
    exit_code: exitCode,
    command: args.command,
    args: args.args,
  };
};
