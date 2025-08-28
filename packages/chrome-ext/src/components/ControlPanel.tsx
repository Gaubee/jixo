import React, {useState, useEffect, useCallback} from "react";
import {getWorkspaceHandle} from "../lib/workspace";

// Type definition for the state received from the background script
interface ConnectionState {
  status: "connected" | "disconnected" | "connecting";
  serverUri: string;
  sessionId: string | null;
}

export function ControlPanel() {
  const [state, setState] = useState<ConnectionState>({
    status: "connecting",
    serverUri: "ws://127.0.0.1:8765",
    sessionId: null,
  });
  const [workspaceName, setWorkspaceName] = useState<string>("");
  const [syncStarted, setSyncStarted] = useState(false);

  // Get workspace name on mount
  useEffect(() => {
    getWorkspaceHandle().then((handle) => {
      if (handle) setWorkspaceName(handle.name);
    });
  }, []);

  const handleStateUpdate = useCallback((message: any) => {
    if (message.type === "STATE_UPDATE") {
      setState(message.payload);
    }
  }, []);

  useEffect(() => {
    chrome.runtime.sendMessage({type: "GET_STATUS"}, (initialState) => {
      if (!chrome.runtime.lastError) setState(initialState);
    });
    chrome.runtime.onMessage.addListener(handleStateUpdate);
    return () => chrome.runtime.onMessage.removeListener(handleStateUpdate);
  }, [handleStateUpdate]);

  const handleConnect = () => {
    chrome.runtime.sendMessage({type: "CONNECT", payload: {uri: state.serverUri}});
  };

  const handleStartSync = async () => {
    const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, {type: "START_SYNC"}, (response) => {
        if (response?.status === "SYNC_STARTED") {
          setSyncStarted(true);
          alert("JIXO sync process has been started on the page.");
        } else {
          alert("Failed to start JIXO sync. Ensure you are on the AI Studio page and have selected a workspace.");
        }
      });
    }
  };

  const renderStatusIndicator = () => {
    const color = {
      connected: "bg-green-500",
      disconnected: "bg-red-500",
      connecting: "bg-yellow-500",
    }[state.status];
    return <span className={`w-3 h-3 rounded-full ${color}`}></span>;
  };

  return (
    <div className="p-4 space-y-4 text-sm">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">JIXO Control Panel</h1>
        <div className="flex items-center gap-2">
          {renderStatusIndicator()}
          <span className="capitalize">{state.status}</span>
        </div>
      </div>

      <div className="p-2 border rounded bg-gray-50">
        <strong>Workspace:</strong> <code className="ml-2 bg-gray-200 px-1 rounded">{workspaceName || "Not Set"}</code>
      </div>

      {state.status === "connected" ? (
        <div className="space-y-3">
          <p className="text-green-700">Successfully connected to jixo-node.</p>
          {!syncStarted && (
            <button onClick={handleStartSync} className="w-full p-2 bg-green-600 text-white rounded hover:bg-green-700">
              Start Page Sync
            </button>
          )}
          <p className="text-xs text-gray-500">Page Sync will connect this browser tab to your local workspace, enabling automated function calls.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="text-xs text-gray-500 p-2 border rounded bg-gray-50">
            <p className="font-semibold">1. Start the local server by running this command in your terminal:</p>
            <code className="block mt-1 p-1 bg-gray-200 text-black rounded text-center">jixo start "{workspaceName}"</code>
          </div>
          <div>
            <label htmlFor="server-uri" className="block font-medium text-gray-700">
              2. Connect to Server
            </label>
            <input type="text" id="server-uri" value={state.serverUri} readOnly className="mt-1 block w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-md shadow-sm" />
          </div>
          <button onClick={handleConnect} className="w-full p-2 bg-blue-500 text-white rounded disabled:bg-gray-400" disabled={state.status === "connecting"}>
            {state.status === "connecting" ? "Connecting..." : "Connect"}
          </button>
        </div>
      )}
    </div>
  );
}
