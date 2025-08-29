import * as Comlink from "comlink";
import {createEndpoint} from "../../service-worker/lib/comlink-extension/index.ts";
import type {BackgroundAPI, ContentScriptAPI} from "./comlink-api-types.ts";

let backgroundAPI: Comlink.Remote<BackgroundAPI> | null = null;

function getBackgroundAPI(): Comlink.Remote<BackgroundAPI> {
  if (!backgroundAPI) {
    const port = chrome.runtime.connect({name: "popup"});
    backgroundAPI = Comlink.wrap<BackgroundAPI>(createEndpoint(port));
  }
  return backgroundAPI;
}

let contentScriptAPI: Comlink.Remote<ContentScriptAPI> | null = null;
/**
 * Retrieves the Comlink-wrapped API for the content script of the currently active tab.
 * This is the primary way for the popup to interact with the page.
 */
export async function getActiveContentScriptAPI(): Promise<Comlink.Remote<ContentScriptAPI> | undefined> {
  try {
    if (contentScriptAPI) {
      return contentScriptAPI;
    }
    const [activeTab] = await chrome.tabs.query({active: true, currentWindow: true});
    const tabId = activeTab.id;
    if (tabId != null) {
      const port = chrome.runtime.connect({name: `popup-to-content-script/${tabId}`});
      port.onDisconnect.addListener(() => {
        contentScriptAPI = null;
      });
      contentScriptAPI = Comlink.wrap(createEndpoint(port));
      // const remoteApi = await background.getActiveContentScript(tabId);
      if (await contentScriptAPI.ping()) {
        return contentScriptAPI;
      }
    }
  } catch (error) {
    contentScriptAPI = null;
    console.error("Failed to get active content script API:", error);
  }
}
