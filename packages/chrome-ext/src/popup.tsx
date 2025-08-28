// packages/chrome-ext/src/App.tsx
import React, {useState, useEffect} from "react";
import {ControlPanel} from "./components/ControlPanel.tsx";
import {WorkspaceSetup} from "./components/WorkspaceSetup.tsx";
import {getWorkspaceHandle, storeWorkspaceHandle} from "./lib/workspace.ts";

type AppState = "initializing" | "needs-setup" | "ready";

export function App() {
  const [appState, setAppState] = useState<AppState>("initializing");

  useEffect(() => {
    // Check if we already have a workspace handle on startup.
    getWorkspaceHandle().then((handle) => {
      if (handle) {
        setAppState("ready");
      } else {
        setAppState("needs-setup");
      }
    });
  }, []);

  const handleWorkspaceSelected = (handle: FileSystemDirectoryHandle) => {
    storeWorkspaceHandle(handle);
    setAppState("ready");
  };

  if (appState === "initializing") {
    return <p>Loading...</p>;
  }

  if (appState === "needs-setup") {
    return <WorkspaceSetup onWorkspaceSelected={handleWorkspaceSelected} />;
  }

  return <ControlPanel />;
}
