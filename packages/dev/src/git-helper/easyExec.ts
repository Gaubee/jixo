import {spawn} from "node:child_process";

export interface EasySpawnResult {
  code: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
}
/**
 * 一个健壮的、基于 Promise 的 spawn 封装，用于执行子进程并收集其输出。
 * @param cmd 要执行的命令。
 * @param args 命令的参数数组。
 * @param options spawn 的选项，增加了 cwd 用于指定工作目录。
 * @returns 一个包含 stdout, stderr, code, signal 和任何错误的 Promise 对象。
 */
export const easySpawn = async (cmd: string, args: string[], options: {cwd: string}) => {
  const cp = spawn(cmd, args, {cwd: options.cwd});

  // 使用 Promise.all 并行地收集 stdout, stderr 和进程退出信息
  const [stdout, stderr, closeInfo] = await Promise.all([
    (async () => {
      const out: Buffer[] = [];
      for await (const chunk of cp.stdout) {
        out.push(chunk);
      }
      return Buffer.concat(out).toString("utf-8");
    })(),
    (async () => {
      const err: Buffer[] = [];
      for await (const chunk of cp.stderr) {
        err.push(chunk);
      }
      return Buffer.concat(err).toString("utf-8");
    })(),
    new Promise<{
      code: number | null;
      signal: NodeJS.Signals | null;
    }>((resolve, reject) => {
      // 如果进程启动失败或以非零代码退出，则抛出错误
      cp.on("error", reject);
      cp.on("close", (code, signal) => resolve({code, signal}));
    }),
  ] as const);

  if (closeInfo.code !== 0) {
    const command = `${cmd} ${args.join(" ")}`;
    throw new Error(`Command failed with exit code ${closeInfo.code}: ${command}\nStderr: ${stderr}`);
  }

  return {stdout, stderr, ...closeInfo} satisfies EasySpawnResult;
};
export const emptyEasySpawnResult = Object.freeze({
  stdout: "",
  stderr: "",
  code: 0,
  signal: null,
}) satisfies EasySpawnResult;
