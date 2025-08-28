import {wrap, type Remote} from "comlink";
import {createEndpoint} from "comlink-extension";
import type {BackgroundAPI, ContentScriptAPI} from "./comlink";

let backgroundAPI: Remote<BackgroundAPI> | null = null;

function getBackgroundAPI(): Remote<BackgroundAPI> {
  if (!backgroundAPI) {
    const port = chrome.runtime.connect({name: "popup"});
    backgroundAPI = wrap<BackgroundAPI>(createEndpoint(port));
  }
  return backgroundAPI;
}

/**
 * Retrieves the Comlink-wrapped API for the content script of the currently active tab.
 * This is the primary way for the popup to interact with the page.
 */
export async function getActiveContentScriptAPI(): Promise<Remote<ContentScriptAPI> | null> {
  const background = getBackgroundAPI();
  try {
    const remoteApi = await background.getActiveContentScript();
    return remoteApi;
  } catch (error) {
    console.error("Failed to get active content script API:", error);
    return null;
  }
}
