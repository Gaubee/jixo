import {gray, green, red} from "@gaubee/nodekit";
import {delay, func_remember} from "@gaubee/util";
import Debug from "debug";
import {globby} from "globby";
import fsp from "node:fs/promises";
import {zSession} from "../common/types.js";
export const debug = Debug("jixo:groq");

// --- Session Management ---
export const findActiveGroqSession = func_remember(async (dir: string) => {
  /**查找可用会话 */
  const lookupSession = async (log = false) => {
    const sessionFiles = await globby("*.groq-session.json", {cwd: dir, absolute: true});
    for (const sessionFile of sessionFiles) {
      log && debug(gray("尝试与 groq 建立会话..."), sessionFile);
      try {
        const content = await fsp.readFile(sessionFile, "utf-8");
        const data = JSON.parse(content);
        log && debug(gray("尝试与 groq 建立会话 1"));
        const sessionResult = zSession.safeParse(data);
        log && debug(gray("尝试与 groq 建立会话 2"), sessionResult.success, sessionResult.error);
        const session = sessionResult.data;
        if (session == null) {
          continue;
        }
        const diffTime = Date.now() - session.time;
        log && debug(gray("尝试与 groq 建立会话 3"), diffTime, diffTime <= 5000);
        if (diffTime <= 5000) {
          const windowId = sessionFile.replace(".groq-session.json", "");
          log && debug(gray("尝试与 groq 建立会话 4"), windowId);

          return {
            windowId,
            sessionFile,
            ...session,
          };
        } else {
          /// 删除合法的过期文件
          await fsp.unlink(sessionFile);
        }
      } catch (e) {
        log && debug(gray("尝试与 groq 建立会话 ERR"), 3);
      }
    }
    log && console.log(gray("等待 groq 会话建立"));
  };
  const waitSession = async () => {
    while (true) {
      const session = await lookupSession(true);
      if (session == null) {
        await delay(1000);
        continue;
      }
      console.info(green("groq 会话建立完成"));
      return session;
    }
  };
  const session = await waitSession();
  type SafeSession = typeof session;

  /// 初次建立连接，删除tasks文件，因为这些任务文件是与上次运行的内存promise关联，所以已经失去意义
  const taskFiles = await globby(`${session.windowId}.*.groq-task.json`);
  for (const taskfile of taskFiles) {
    await fsp.unlink(taskfile);
  }

  let preTime = session.time;

  /// 定时更新会话
  void (async () => {
    /**
     * 如果有值，说明在等待会话重新建立
     */
    let statusJob: PromiseWithResolvers<SafeSession> | undefined;
    while (true) {
      {
        await delay(500);
        /// 更新会话
        const newSession = await lookupSession();
        if (newSession) {
          Object.assign(session, newSession);
        }
      }
      preTime = session.time;
      const diffTime = Date.now() - preTime;
      if (Date.now() - preTime > 5000) {
        if (statusJob == null) {
          statusJob = Promise.withResolvers();
          Reflect.set(session, "then", statusJob.promise.then.bind(statusJob.promise));
        }
        console.error(red("groq 会话断开，请激活窗口，确保重连"), `${diffTime}ms`);
        await delay(500);
      } else {
        if (statusJob) {
          Reflect.deleteProperty(session, "then");
          statusJob.resolve(session);
          statusJob = undefined;
          console.info(green("groq 会话恢复建立"), `${diffTime}ms`);
        }
      }
    }
  })();
  // 5 second timeout
  return session;
});
