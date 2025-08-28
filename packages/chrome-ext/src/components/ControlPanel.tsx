import React, {useState, useEffect, useCallback} from "react";

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

  const handleStateUpdate = useCallback((message: any) => {
    if (message.type === "STATE_UPDATE") {
      setState(message.payload);
    }
  }, []);

  useEffect(() => {
    chrome.runtime.sendMessage({type: "GET_STATUS"}, (initialState) => {
      if (chrome.runtime.lastError) {
        console.error("Error getting initial state:", chrome.runtime.lastError.message);
        setState((s) => ({...s, status: "disconnected"}));
      } else {
        setState(initialState);
      }
    });
    chrome.runtime.onMessage.addListener(handleStateUpdate);
    return () => chrome.runtime.onMessage.removeListener(handleStateUpdate);
  }, [handleStateUpdate]);

  const handleConnect = () => {
    chrome.runtime.sendMessage({type: "CONNECT", payload: {uri: state.serverUri}});
  };

  const handleUriChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setState((prevState) => ({...prevState, serverUri: e.target.value}));
  };

  const handleDebugAskUser = () => {
    chrome.runtime.sendMessage({
      type: "DEBUG_RENDER_UI",
      payload: {
        component: "AskUserDialog",
        props: {
          question: "This is a test question from the debug button.",
          options: ["Option A", "Option B"],
        },
      },
    });
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

      {state.status === "connected" ? (
        <div>
          <p>
            Session ID: <code className="bg-gray-200 px-1 rounded">{state.sessionId || "N/A"}</code>
          </p>
          <button onClick={handleDebugAskUser} className="mt-4 w-full p-2 bg-purple-500 text-white rounded">
            Debug: Simulate AskUser
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <label htmlFor="server-uri" className="block font-medium text-gray-700">
              Server URI
            </label>
            <input
              type="text"
              id="server-uri"
              value={state.serverUri}
              onChange={handleUriChange}
              className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm"
            />
          </div>
          <button onClick={handleConnect} className="w-full p-2 bg-blue-500 text-white rounded disabled:bg-gray-400" disabled={state.status === "connecting"}>
            {state.status === "connecting" ? "Connecting..." : "Connect"}
          </button>
          <div className="text-xs text-gray-500 p-2 border rounded bg-gray-50">
            <p className="font-semibold">To start the local server, run:</p>
            <code className="block mt-1 p-1 bg-gray-200 text-black rounded text-center">npx jixo-sync-google-aistudio --watch</code>
          </div>
        </div>
      )}
    </div>
  );
}
