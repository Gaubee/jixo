import React, {useCallback, useEffect, useState} from "react";
import {createRoot} from "react-dom/client";
import type {JixoTab} from "../web/isolated/lib/comlink-api-types.ts";
import {getSidePanelAPI} from "../web/isolated/lib/comlink-client.ts";
import "./styles.css";

function SidePanelApp() {
  const [tabs, setTabs] = useState<JixoTab[]>([]);
  const [error, setError] = useState<string | null>(null);
  const sidepanelAPI = getSidePanelAPI();

  const fetchTabs = useCallback(async () => {
    try {
      const jixoTabs = await sidepanelAPI.getJixoTabs();
      setTabs(jixoTabs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch tabs.");
    }
  }, [sidepanelAPI]);

  useEffect(() => {
    fetchTabs();
    const onUpdate = () => fetchTabs();
    chrome.tabs.onUpdated.addListener(onUpdate);
    chrome.tabs.onRemoved.addListener(onUpdate);
    chrome.tabs.onActivated.addListener(onUpdate);
    return () => {
      chrome.tabs.onUpdated.removeListener(onUpdate);
      chrome.tabs.onRemoved.removeListener(onUpdate);
      chrome.tabs.onActivated.removeListener(onUpdate);
    };
  }, [fetchTabs]);

  const handleTabClick = (tabId: number) => {
    sidepanelAPI.switchToTab(tabId).catch((err) => {
      setError("Could not switch to the selected tab.");
    });
  };

  return (
    <div className="p-2 space-y-2 text-sm">
      <h1 className="text-base font-bold border-b pb-2 mb-2 text-gray-700">JIXO Active Sessions</h1>
      {error && <p className="text-red-500 p-2 bg-red-50 rounded">{error}</p>}
      {tabs.length === 0 && !error && <p className="text-gray-500 px-2">No active AI Studio tabs found.</p>}
      <ul className="space-y-1">
        {tabs.map((tab) => (
          <li key={tab.id}>
            <button
              onClick={() => handleTabClick(tab.id)}
              title={tab.title}
              className={`w-full text-left p-2 rounded flex items-center gap-2 transition-colors ${tab.isActive ? "bg-blue-100 ring-1 ring-blue-300" : "hover:bg-gray-100"}`}
            >
              <img src={tab.favIconUrl || "/icons/icon16.png"} className="w-4 h-4 flex-shrink-0" />
              <span className="truncate flex-grow font-medium text-gray-800">{tab.title}</span>
              {tab.isActive && <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 animate-pulse"></span>}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

const rootEl = document.getElementById("root");
if (rootEl) {
  const root = createRoot(rootEl);
  root.render(
    <React.StrictMode>
      <SidePanelApp />
    </React.StrictMode>,
  );
}
