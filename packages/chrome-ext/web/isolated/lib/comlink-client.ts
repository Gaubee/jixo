import { Comlink } from "@jixo/dev/comlink";
import {createEndpoint} from "@/lib/comlink-extension/index.ts";
import type {BackgroundAPI, ContentScriptAPI, SidePanelAPI} from "./comlink-api-types.ts";

// --- Singleton API Proxies ---
let backgroundAPI: Comlink.Remote<BackgroundAPI> | null = null;
let sidePanelAPI: Comlink.Remote<SidePanelAPI> | null = null;
let contentScriptAPI: Comlink.Remote<ContentScriptAPI> | null = null;

export function getBackgroundAPI(): Comlink.Remote<BackgroundAPI> {
  if (!backgroundAPI) {
    const port = chrome.runtime.connect({name: "background"});
    backgroundAPI = Comlink.wrap<BackgroundAPI>(createEndpoint(port));
  }
  return backgroundAPI;
}

export function getSidePanelAPI(): Comlink.Remote<SidePanelAPI> {
  if (!sidePanelAPI) {
    const port = chrome.runtime.connect({name: "sidepanel"});
    sidePanelAPI = Comlink.wrap<SidePanelAPI>(createEndpoint(port));
  }
  return sidePanelAPI;
}

export async function getActiveContentScriptAPI(): Promise<Comlink.Remote<ContentScriptAPI>> {
  if (contentScriptAPI) {
    try {
      // Use ping to check if connection is still alive
      await contentScriptAPI.ping();
      return contentScriptAPI;
    } catch (e) {
      console.warn("Cached content script API seems dead, creating a new one.");
    }
  }

  const [activeTab] = await chrome.tabs.query({active: true, currentWindow: true});
  if (!activeTab?.id) {
    throw new Error("No active tab found.");
  }

  const port = chrome.runtime.connect({name: `content-script-proxy/${activeTab.id}`});
  contentScriptAPI = Comlink.wrap<ContentScriptAPI>(createEndpoint(port));
  port.onDisconnect.addListener(() => {
    contentScriptAPI = null;
  });

  return contentScriptAPI;
}
