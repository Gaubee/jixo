import * as Comlink from "comlink";
import type {JixoTab} from "../web/lib/comlink-api-types.ts";
import {createBackgroundEndpoint} from "./lib/comlink-extension/index.ts";

let contentScriptPorts: Map<number, chrome.runtime.Port>;

export const sidePanelAPI = {
  async getJixoTabs(): Promise<JixoTab[]> {
    // Query all tabs that match the URL
    const allTabs = await chrome.tabs.query({url: "https://aistudio.google.com/*"});
    const [activeTab] = await chrome.tabs.query({active: true, currentWindow: true});

    // Filter tabs to only those that have an active content script connection
    const jixoTabs = allTabs
      .filter((tab) => tab.id && contentScriptPorts.has(tab.id))
      .map((tab) => ({
        id: tab.id!,
        title: tab.title || "AI Studio",
        url: tab.url || "",
        favIconUrl: tab.favIconUrl,
        isActive: activeTab?.id === tab.id,
      }));

    return jixoTabs;
  },

  async switchToTab(tabId: number): Promise<void> {
    await chrome.tabs.update(tabId, {active: true});
    const tab = await chrome.tabs.get(tabId);
    if (tab.windowId) {
      await chrome.windows.update(tab.windowId, {focused: true});
    }
  },
};

export function initializeSidePanel(portsMap: Map<number, chrome.runtime.Port>): void {
  contentScriptPorts = portsMap;

  chrome.sidePanel.setPanelBehavior({openPanelOnActionClick: true}).catch((error) => console.error(error));

  chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {
    if (tab.url && tab.url.startsWith("https://aistudio.google.com/")) {
      await chrome.sidePanel.setOptions({tabId, path: "sidepanel.html", enabled: true});
    } else {
      await chrome.sidePanel.setOptions({tabId, enabled: false});
    }
  });

  // Expose the API for the sidepanel UI
  chrome.runtime.onConnect.addListener((port) => {
    if (port.name === "sidepanel") {
      console.log("JIXO BG: Side panel UI connected.");
      Comlink.expose(sidePanelAPI, createBackgroundEndpoint(port));
    }
  });

  console.log("JIXO BG: Side panel logic initialized.");
}
