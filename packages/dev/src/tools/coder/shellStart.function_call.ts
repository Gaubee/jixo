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
        "tty 模式意味着程序将执行在一个“窗口”下，程序可以精确控制窗口的渲染内容，但是 tty 模式只能获得 output 内容，无法区分stdout 和 stderr。",
        "cp 模式则是管道，可以清晰地获得 stdout 和 stderr 的内容。",
        "如果使用tty模式，这是用户在自己终端中执行命令默认会看到的内容。",
        "如果只是要执行一些简单的命令，那么使用cp模式会更方便。",
        "如果是要执行一些长时间运行的任务，这种任务通常会控制终端的输出而选择基于tty进行开发，那么建议使用tty模式。",
        "比如`tsc --build --watch`是会在编译的时候刷新tty窗口。",
        "比如`tsc --build`则是一次性任务输出，那么使用cp模式会更方便。",
        "**默认值:**",
        "默认使用tty模式。",
      ].join("\n"),
    )
    .optional()
    .default("tty"),
  output: z
    .union([z.literal("raw"), z.literal("text"), z.literal("html")])
    .describe(
      [
        //
        "**输出格式:**",
        "- raw: 原始输出，不进行任何处理。",
        "- text: 纯文本输出，在原始输出的基础上进行格式化。剔除颜色和样式。",
        "- html: HTML输出，将ansi码转换为HTML。",
      ].join("\n"),
    )
    .optional()
    .default("text"),
});

/**
 * 调用 @jixo/jun 的 junStartLogic 来执行后台命令。
 * @param args - 符合paramsSchema的参数
 * @returns 一个包含jun任务信息的对象
 */
export const functionCall = (async (args) => {
  // For background tasks, we capture the JSON output to get the PID.
  let pid = -1;
  let osPid = -1;
  const originalConsoleLog = console.log;
  let jsonOutput = "";
  console.log = (data) => {
    jsonOutput = data;
  }; // Hijack console.log

  try {
    await junStartLogic({
      command: args.command,
      commandArgs: args.args,
      json: true,
      output: args.output,
      mode: args.mode,
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
}) satisfies FunctionCallFn<z.infer<typeof paramsSchema>>;
