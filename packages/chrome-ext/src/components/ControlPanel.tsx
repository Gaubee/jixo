import React, {useState, useEffect} from "react";
import {getActiveContentScriptAPI} from "../lib/comlink-client";

interface ControlPanelProps {
  workspaceName: string;
}

export function ControlPanel({workspaceName}: ControlPanelProps) {
  const [syncStatus, setSyncStatus] = useState<"idle" | "starting" | "started" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const handleStartSync = async () => {
    setSyncStatus("starting");
    setError(null);
    try {
      const contentScriptAPI = await getActiveContentScriptAPI();
      if (!contentScriptAPI) {
        throw new Error("Could not connect to the content script on the active page.");
      }
      const result = await contentScriptAPI.startSync();
      if (result.status === "SYNC_STARTED") {
        setSyncStatus("started");
      } else {
        throw new Error(result.message || "Failed to start sync process.");
      }
    } catch (err) {
      setSyncStatus("error");
      setError(err instanceof Error ? err.message : "An unknown error occurred.");
    }
  };

  return (
    <div className="p-4 space-y-4 text-sm">
      <h1 className="text-lg font-bold">JIXO Control Panel</h1>

      <div className="p-2 border rounded bg-gray-50">
        <strong>Workspace:</strong> <code className="ml-2 bg-gray-200 px-1 rounded">{workspaceName}</code>
      </div>

      <div className="space-y-3">
        <button
          onClick={handleStartSync}
          className="w-full p-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400"
          disabled={syncStatus === "starting" || syncStatus === "started"}
        >
          {syncStatus === "idle" && "Start Page Sync"}
          {syncStatus === "starting" && "Starting..."}
          {syncStatus === "started" && "Sync is Active"}
          {syncStatus === "error" && "Retry Sync"}
        </button>
        <p className="text-xs text-gray-500">Click "Start Page Sync" to connect this browser tab to your local workspace, enabling automated function calls.</p>
        {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
      </div>
    </div>
  );
}
