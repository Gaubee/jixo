import React, {useState} from "react";

// In the new model, ControlPanel receives functions directly from its parent (content-script)
interface ControlPanelProps {
  workspaceName: string;
  onStartSync: () => Promise<{status: string; message?: string}>;
  onApplyConfig: () => Promise<{status: string; message?: string; appliedSettings: string[]}>;
}

export function ControlPanel({workspaceName, onStartSync, onApplyConfig}: ControlPanelProps) {
  const [syncStatus, setSyncStatus] = useState<"idle" | "starting" | "started" | "error">("idle");
  const [configStatus, setConfigStatus] = useState<"idle" | "applying" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const handleStartSync = async () => {
    setSyncStatus("starting");
    setError(null);
    try {
      const result = await onStartSync();
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

  const handleApplyConfig = async () => {
    setConfigStatus("applying");
    setError(null);
    try {
      const result = await onApplyConfig();
      if (result.status === "SUCCESS") {
        setConfigStatus("success");
        setTimeout(() => setConfigStatus("idle"), 2000);
      } else {
        throw new Error(result.message || "Failed to apply config.");
      }
    } catch (err) {
      setConfigStatus("error");
      setError(err instanceof Error ? err.message : "An unknown error occurred.");
    }
  };

  return (
    <div className="p-4 space-y-4 text-sm">
      <div className="p-2 border rounded bg-gray-50">
        <strong>Workspace:</strong> <code className="ml-2 bg-gray-200 px-1 rounded">{workspaceName}</code>
      </div>
      <div className="space-y-3">
        <button onClick={handleStartSync} className="w-full p-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400" disabled={syncStatus !== "idle"}>
          {syncStatus === "idle" && "Start Page Sync"}
          {syncStatus === "starting" && "Starting..."}
          {syncStatus === "started" && "Sync is Active"}
          {syncStatus === "error" && "Retry Sync"}
        </button>
      </div>
      <div className="space-y-3 pt-3 border-t">
        <button onClick={handleApplyConfig} className="w-full p-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:bg-gray-400" disabled={configStatus === "applying"}>
          {configStatus === "idle" && "Apply Config to Page"}
          {configStatus === "applying" && "Applying..."}
          {configStatus === "success" && "✅ Config Applied!"}
          {configStatus === "error" && "Retry Apply Config"}
        </button>
      </div>
      {error && <p className="text-sm text-red-500 mt-2 p-2 bg-red-50 rounded border border-red-200">{error}</p>}
    </div>
  );
}
