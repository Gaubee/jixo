import {abort_signal_race} from "@gaubee/util";
import {Comlink} from "@jixo/dev/comlink";
import {useCallback, useContext, useEffect, useState} from "react";
import type {MainContentScriptAPI} from "../../main/lib/content-script-api.ts";
import {SessionAPICtx} from "../components/context.ts";
import type {IsolatedContentScriptAPI} from "../lib/content-script-api.tsx";

export type WorkspaceStatus = "unknown" | "browser-ready" | "ready" | "missing";

export function useWorkspace(mainApi: Comlink.Remote<MainContentScriptAPI>, isolatedApi: IsolatedContentScriptAPI) {
  const [workspaceStatus, setWorkspaceStatus] = useState<WorkspaceStatus>("unknown");
  const [workspaceName, setWorkspaceName] = useState<string>("");
  const [workDirFullpath, setWorkDirFullpath] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const sessionApi = useContext(SessionAPICtx);

  const initWorkspace = useCallback(async () => {
    const name = await mainApi.getWorkspaceHandleName();
    if (name) {
      setWorkspaceName(name);
      await mainApi.startSync();
      if (await sessionApi.hasWorkDir()) {
        setWorkDirFullpath(await sessionApi.getWorkDir());
        setWorkspaceStatus("ready");
      } else {
        setWorkspaceStatus("browser-ready");
      }
    } else {
      setWorkspaceStatus("missing");
    }
  }, [mainApi, isolatedApi]);

  useEffect(() => {
    initWorkspace();
  }, [initWorkspace]);

  const selectWorkspace = useCallback(async () => {
    setIsLoading(true);
    try {
      const name = await mainApi.updateWorkspaceHandle();
      if (name) {
        setWorkspaceName(name);
        await mainApi.startSync();

        /// 要求用户在指定文件夹运行命令来正式选中文件夹
        /**
         * @JIXO 由于浏览器的安全性，我们无法在浏览器中获得完整的文件夹路径，所以这里需要做两次文件夹选择，一次在浏览器上，一次在本地
         * 未来我们将彻底废弃这种选择两次的别扭做法，我们将开发一个 tauri+deno 应用，由这个程序来提供文件夹选择的能力，同时放弃 浏览器的FileSystem：
         * 我们将通过Comlink来为浏览器提供一份EasyFS的适配层
         */
        await sessionApi.unsetWorkDir();
        setWorkDirFullpath("");
        setWorkspaceStatus("browser-ready");
      }
    } finally {
      setIsLoading(false);
    }
  }, [isolatedApi]);

  useEffect(() => {
    const signalController = new AbortController();
    const signal = signalController.signal;
    (async () => {
      if (workspaceStatus === "browser-ready") {
        void (async () => {
          const workDir = await abort_signal_race(signal, sessionApi.getWorkDir());
          setWorkDirFullpath(workDir);
          setWorkspaceStatus("ready");
        })();

        while (!signal.aborted) {
          const workDir = await sessionApi.whenWorkDirChanged();
          setWorkDirFullpath(workDir);
        }
      }
    })();
    return () => {
      signalController.abort();
    };
  }, [workspaceStatus]);

  return {workspaceStatus, workspaceName, selectWorkspace, workDirFullpath, isLoading};
}
