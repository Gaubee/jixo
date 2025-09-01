import React, {useState, useEffect} from "react";
import {ControlPanel} from "./ControlPanel.tsx";
import {WorkspaceSetup} from "./WorkspaceSetup.tsx";
import {getWorkspaceHandle} from "../lib/workspace.ts";
import type {ContentScriptAPI} from "../lib/content-script-api.tsx";

type AppState = "initializing" | "needs-setup" | "ready";

interface AppProps {
  api: Pick<ContentScriptAPI, "selectWorkspace" | "startSync" | "applyConfig">;
}

export function App({api}: AppProps) {
  const [appState, setAppState] = useState<AppState>("initializing");
  const [workspaceName, setWorkspaceName] = useState<string>("");

  useEffect(() => {
    getWorkspaceHandle().then((handle) => {
      if (handle) {
        setWorkspaceName(handle.name);
        setAppState("ready");
      } else {
        setAppState("needs-setup");
      }
    });
  }, []);

  const handleWorkspaceSelected = (name: string) => {
    setWorkspaceName(name);
    setAppState("ready");
  };

  if (appState === "initializing") {
    return <div className="p-4 text-center">Initializing...</div>;
  }

  if (appState === "needs-setup") {
    return <WorkspaceSetup onWorkspaceSelected={handleWorkspaceSelected} selectWorkspace={api.selectWorkspace} />;
  }

  return <ControlPanel workspaceName={workspaceName} onStartSync={api.startSync} onApplyConfig={api.applyConfig} />;
}
