import {gray, green, red} from "@gaubee/nodekit";
import {delay, func_remember} from "@gaubee/util";
import {globby} from "globby";
import fsp from "node:fs/promises";
import path from "node:path";
import type {Session} from "../common/types.js";
import {zSession} from "../common/types.js";
import {debug} from "./utils.js";

export type GroqSession = Session & {windowId: string; sessionFile: string};

// --- Session Management ---
export const findActiveGroqSession = func_remember(async (dir: string): Promise<GroqSession> => {
  const absoluteDir = path.resolve(dir);

  /**查找可用会话 */
  const lookupSession = async (log = false) => {
    const sessionFiles = await globby("*.groq-session.json", {cwd: absoluteDir, absolute: true});
    for (const sessionFile of sessionFiles) {
      log && debug(gray("尝试与 groq 建立会话..."), sessionFile);
      try {
        const content = await fsp.readFile(sessionFile, "utf-8");
        const data = JSON.parse(content);
        const sessionResult = zSession.safeParse(data);
        const session = sessionResult.data;
        if (session == null) {
          continue;
        }
        const diffTime = Date.now() - session.time;
        if (diffTime <= 5000) {
          const windowId = path.basename(sessionFile, ".groq-session.json");
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
        // Ignore errors
      }
    }
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

  /// 初次建立连接，删除tasks文件，因为这些任务文件是与上次运行的内存promise关联，所以已经失去意义
  // The new glob pattern matches all files related to a task prefix.
  const taskFiles = await globby(`${session.windowId}.*.groq-task.*`, {cwd: absoluteDir, absolute: true});
  for (const taskfile of taskFiles) {
    await fsp.unlink(taskfile);
  }

  let preTime = session.time;

  /// 定时更新会话
  void (async () => {
    let isDisconnected = false;
    while (true) {
      try {
        await delay(2000); // Check every 2 seconds
        /// 更新会话
        const newSession = await lookupSession();
        if (newSession) {
          Object.assign(session, newSession);
          preTime = newSession.time;
        }

        if (Date.now() - preTime > 5000) {
          if (!isDisconnected) {
            isDisconnected = true;
            console.error(red("groq 会话断开，请激活窗口，确保重连"));
          }
        } else {
          if (isDisconnected) {
            isDisconnected = false;
            console.info(green("groq 会话恢复建立"));
          }
        }
      } catch (err) {
        console.error(red("Session monitoring loop encountered an error:"), err);
      }
    }
  })();

  return session;
});
