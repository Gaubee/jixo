import React, {useState, useEffect} from "react";
import {ControlPanel} from "./components/ControlPanel.tsx";
import {WorkspaceSetup} from "./components/WorkspaceSetup.tsx";
import {getWorkspaceHandle} from "./lib/workspace.ts";

type AppState = "initializing" | "needs-setup" | "ready";

export function App() {
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
    return <div className="p-4 text-center">Loading...</div>;
  }

  if (appState === "needs-setup") {
    return <WorkspaceSetup onWorkspaceSelected={handleWorkspaceSelected} />;
  }

  return <ControlPanel workspaceName={workspaceName} />;
}
