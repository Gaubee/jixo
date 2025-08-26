import {junRunLogic} from "jsr:@jixo/jun";
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
export const functionCall = async (args: z.infer<typeof paramsSchema>) => {
  // 注意：后台运行在 FunctionCall 模型中是一个挑战，
  // 因为它会创建一个“孤儿”进程。
  // 这里的实现假设执行环境能够处理这种情况。
  // 对于非后台任务，我们直接等待结果。
  if (!args.background) {
    const exitCode = await junRunLogic(args.command, args.args);
    return {
      status: exitCode === 0 ? "COMPLETED" : "ERROR",
      exit_code: exitCode,
      command: args.command,
      args: args.args,
    };
  }

  // 对于后台任务，我们启动它但不等待它。
  // 这将在当前进程退出后继续运行。
  const process = new Deno.Command(Deno.execPath(), {
    args: ["run", "-A", "jsr:@jixo/jun/cli", "run", args.command, ...args.args],
    // 在这个模型中，我们无法轻易获取到 jun 的 pid。
    // 这是一个需要进一步设计的点，暂时返回一个表示任务已启动的消息。
  }).spawn();

  // 我们无法安全地杀死这个子进程，所以我们 unref 它，
  // 允许父进程（我们的工具执行器）退出。
  process.unref();

  return {
    status: "STARTED_IN_BACKGROUND",
    command: args.command,
    args: args.args,
    message: "Task started. Use shellList to find its PID.",
  };
};

// JIXO_CODER_EOF
