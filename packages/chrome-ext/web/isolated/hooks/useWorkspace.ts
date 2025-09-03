import * as Comlink from "comlink";
import {useCallback, useEffect, useState} from "react";
import type {MainContentScriptAPI} from "../../main/lib/content-script-api.ts";
import type {IsolatedContentScriptAPI} from "../lib/content-script-api.tsx";

export type WorkspaceStatus = "unknown" | "ready" | "missing";

export function useWorkspace(mainApi: Comlink.Remote<MainContentScriptAPI>, isolatedApi: IsolatedContentScriptAPI) {
  const [workspaceStatus, setWorkspaceStatus] = useState<WorkspaceStatus>("unknown");
  const [workspaceName, setWorkspaceName] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  const checkWorkspace = useCallback(async () => {
    const name = await mainApi.getWorkspaceHandleName();
    if (name) {
      setWorkspaceName(name);
      setWorkspaceStatus("ready");
      mainApi.startSync();
    } else {
      setWorkspaceStatus("missing");
    }
  }, [mainApi, isolatedApi]);

  useEffect(() => {
    checkWorkspace();
  }, [checkWorkspace]);

  const selectWorkspace = useCallback(async () => {
    setIsLoading(true);
    try {
      const name = await mainApi.updateWorkspaceHandle();
      if (name) {
        setWorkspaceName(name);
        setWorkspaceStatus("ready");
        await mainApi.startSync();
      }
    } finally {
      setIsLoading(false);
    }
  }, [isolatedApi]);

  return {workspaceStatus, workspaceName, selectWorkspace, isLoading};
}
