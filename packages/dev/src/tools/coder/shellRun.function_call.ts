import {junRunLogic} from "@jixo/jun";
import {z} from "zod/v4";
import type {FunctionCallFn} from "../types.js";

export const name = "shellRun";

export const description = "使用jun代理在前台执行一个shell命令。此工具会等待命令执行完成，并返回包含stdio和退出码的完整结果。";

export const paramsSchema = z.object({
  command: z.string().describe("要执行的主命令。"),
  args: z.array(z.string()).optional().default([]).describe("命令的参数列表。"),
  mode: z
    .union([z.literal("tty"), z.literal("cp")])
    .describe(
      [
        //
        "**执行模式:**",
        "- tty: 将使用 node-pty 来执行命令，混合stdout/stderr。",
        "- cp: 将使用 node:child_process.spawn/pipe 来执行，区分stdout/stderr。",
        "**默认值:** 'cp'，以便清晰地区分输出流。",
      ].join("\n"),
    )
    .optional()
    .default("cp"),
  timeout: z.number().int().positive().optional().describe("命令的最长执行时间（毫秒）。超时后命令将被终止。"),
  idleTimeout: z.number().int().positive().optional().describe("自上次输出以来的最长空闲时间（毫秒）。超时后命令将被终止。"),
});

/**
 * 调用 @jixo/jun 的 junRunLogic 来执行前台命令。
 * @param args - 符合paramsSchema的参数
 * @returns 一个包含命令执行结果的完整对象
 */
export const functionCall = (async (args) => {
  const result = await junRunLogic({
    command: args.command,
    commandArgs: args.args,
    mode: args.mode,
    timeout: args.timeout,
    idleTimeout: args.idleTimeout,
  });

  // Return a structured result for the AI

  return {
    status: result.isTimeout ? "TIMEOUT" : result.exitCode === 0 ? "COMPLETED" : "ERROR",
    exitCode: result.exitCode,
    ...(result.mode === "cp"
      ? {
          stdout: result.stdout,
          stderr: result.stderr,
        }
      : {
          output: result.output, // For tty mode
        }),
  };
}) satisfies FunctionCallFn<z.infer<typeof paramsSchema>>;
