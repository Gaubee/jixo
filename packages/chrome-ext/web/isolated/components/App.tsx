import * as Comlink from "comlink";
import React, {useEffect, useState} from "react";
import type {MainContentScriptAPI} from "../../main/lib/content-script-api.ts";
import {getWorkspaceHandle} from "../../main/lib/workspace.ts";
import type {IsolatedContentScriptAPI} from "../lib/content-script-api.tsx";
import {ControlPanel} from "./ControlPanel.tsx";
import {WorkspaceSetup} from "./WorkspaceSetup.tsx";
type AppState = "initializing" | "needs-setup" | "ready";

interface AppProps {
  mainApi: Comlink.Remote<MainContentScriptAPI>;
  isolatedApi: IsolatedContentScriptAPI; // Corrected: No Remote wrapper
}

export function App({mainApi, isolatedApi}: AppProps) {
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
    return <WorkspaceSetup onWorkspaceSelected={handleWorkspaceSelected} selectWorkspace={mainApi.selectWorkspace} />;
  }

  return (
    <ControlPanel
      workspaceName={workspaceName}
      mainApi={mainApi}
      onGenerateConfig={isolatedApi.generateConfigFromMetadata}
      onApplyTemplate={isolatedApi.handleApplyTemplate}
      onApplyConfig={isolatedApi.handleApplyConfig}
      onStartSync={isolatedApi.handleStartSync}
    />
  );
}
