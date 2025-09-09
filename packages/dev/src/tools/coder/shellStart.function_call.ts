import {junStartLogic} from "@jixo/jun";
import {z} from "zod/v4";
import type {FunctionCallFn} from "../types.js";

export const name = "shellStart";

export const description = "使用jun代理在后台启动一个shell命令。此工具会立即返回任务pid，而不会等待命令完成。";

export const paramsSchema = z.object({
  command: z.string().describe("要执行的主命令。"),
  args: z.array(z.string()).optional().default([]).describe("命令的参数列表。"),
  mode: z
    .union([z.literal("tty"), z.literal("cp")])
    .describe(
      [
        //
        "**执行模式:**",
        "- tty: 将使用 node-pty 来执行命令。",
        "- cp: 将使用 node:child_process.spawn/pipe 来执行。",
        "**默认值:** 'tty'，因为后台任务通常是服务或监听器，更适合终端模拟。",
      ].join("\n"),
    )
    .optional()
    .default("tty"),
});

/**
 * 调用 @jixo/jun 的 junStartLogic 来执行后台命令。
 * @param args - 符合paramsSchema的参数
 * @returns 一个包含jun任务信息的对象
 */
export const functionCall = (async (args) => {
  return await junStartLogic({
    command: args.command,
    commandArgs: args.args,
    mode: args.mode,
  });
}) satisfies FunctionCallFn<z.infer<typeof paramsSchema>>;
