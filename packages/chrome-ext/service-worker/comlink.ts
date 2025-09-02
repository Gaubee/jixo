import * as Comlink from "comlink";
import type {IsolatedContentScriptAPI} from "../web/isolated/lib/content-script-api.tsx"; // Fixed path
import {createBackgroundEndpoint, createEndpoint} from "./lib/comlink-extension/index.ts"; // Fixed import
import {sidePanelAPI} from "./sidepanel.ts";

export const contentScriptPorts = new Map<number, chrome.runtime.Port>();

export class BackgroundAPI {
  async renderComponentInActiveTab(componentName: string, jobId: string | null, props: any): Promise<void> {
    const [activeTab] = await chrome.tabs.query({active: true, currentWindow: true});
    if (activeTab?.id) {
      const port = contentScriptPorts.get(activeTab.id);
      if (port) {
        const api = Comlink.wrap<IsolatedContentScriptAPI>(createEndpoint(port));
        return await api.renderComponent(componentName, jobId, props);
      } else {
        throw new Error("JIXO content script not connected on the active tab.");
      }
    } else {
      throw new Error("No active tab found.");
    }
  }
}

let backgroundApiInstance: BackgroundAPI | null = null;

export function initializeComlink() {
  if (!backgroundApiInstance) {
    backgroundApiInstance = new BackgroundAPI();
  }

  chrome.runtime.onConnect.addListener((port) => {
    console.log(`JIXO BG: New connection from '${port.name}'`);

    if (port.name === "content-script") {
      const tabId = port.sender?.tab?.id;
      if (tabId) {
        contentScriptPorts.set(tabId, port);
        port.onDisconnect.addListener(() => contentScriptPorts.delete(tabId));
      }
    } else if (port.name === "sidepanel") {
      Comlink.expose(sidePanelAPI, createBackgroundEndpoint(port));
    } else if (port.name === "background") {
      // For jixo-node
      Comlink.expose(backgroundApiInstance, createBackgroundEndpoint(port));
    }
  });

  console.log("JIXO BG: Comlink listeners initialized.");
  return {backgroundAPI: backgroundApiInstance, contentScriptPorts};
}
