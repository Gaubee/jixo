import {createBackgroundEndpoint, createEndpoint} from "@/lib/comlink-extension/index.ts";
import {map_get_or_put} from "@gaubee/util";
import {Comlink} from "@jixo/dev/comlink";
import type {IsolatedContentScriptAPI} from "../web/isolated/lib/content-script-api.tsx";
import {sidePanelAPI} from "./sidepanel.ts";
import {globalWebSocket} from "./websocket.ts";

export const contentScriptPorts = new Map<number, chrome.runtime.Port>();

export class BackgroundAPI {
  #activeTabApi = new WeakMap<chrome.runtime.Port, Comlink.Remote<IsolatedContentScriptAPI>>();
  #getActiveTabApi = async () => {
    const [activeTab] = await chrome.tabs.query({active: true, currentWindow: true});

    const tabId = activeTab.id;
    if (null == tabId) {
      console.error("No active tab found.");
      return;
    }
    const port = contentScriptPorts.get(tabId);
    if (null == port) {
      console.error("JIXO content script not connected on the active tab.");
      return;
    }
    return map_get_or_put(this.#activeTabApi, port, (port) => {
      return Comlink.wrap<IsolatedContentScriptAPI>(createEndpoint(port));
    });
  };
  async renderJobInActiveTab(componentName: string, jobId: string, props: any): Promise<void> {
    const api = await this.#getActiveTabApi();
    return await api?.renderJob({componentName, jobId, props});
  }

  getServiceStatus() {
    return globalWebSocket.getStatus();
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
