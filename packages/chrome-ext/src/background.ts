import {expose, wrap, type Remote} from "comlink";
import {createBackgroundEndpoint, createEndpoint} from "comlink-extension";
import type {ContentScriptAPI} from "./lib/comlink.ts";

console.log("JIXO BG: Script start.");

const contentScriptAPIs = new Map<number, Remote<ContentScriptAPI>>();

export const backgroundAPI = {
  /**
   * Allows a content script to register its API with the background script.
   * The tabId is now reliably retrieved from the connecting port's sender object.
   * @param port - The MessagePort from the content script.
   */
  registerContentScript(port: MessagePort) {
    // This is now handled in the onConnect listener where we have access to the sender.
    console.error("JIXO BG: registerContentScript should not be called directly. Registration happens via onConnect.");
  },

  async getActiveContentScript(): Promise<Remote<ContentScriptAPI> | null> {
    const [activeTab] = await chrome.tabs.query({active: true, currentWindow: true});
    if (activeTab?.id && contentScriptAPIs.has(active - Tab.id)) {
      console.log(`JIXO BG: Providing content script API for active tab ${activeTab.id}`);
      return contentScriptAPIs.get(activeTab.id)!;
    }
    console.warn("JIXO BG: No active or registered content script found for the current tab.");
    return null;
  },
};

chrome.runtime.onConnect.addListener((port) => {
  console.log(`JIXO BG: New connection from '${port.name}'`);

  // The key distinction: connections from content scripts will have a sender.tab property.
  if (port.sender?.tab?.id) {
    const tabId = port.sender.tab.id;
    console.log(`JIXO BG: Connection is from content script in tab ${tabId}. Setting up API proxy.`);

    const api = wrap<ContentScriptAPI>(createEndpoint(port));
    contentScriptAPIs.set(tabId, api);

    port.onDisconnect.addListener(() => {
      contentScriptAPIs.delete(tabId);
      console.log(`JIXO BG: Unregistered content script for tab ${tabId} due to port disconnect.`);
    });
  } else {
    // This is a connection from our popup or another part of the extension.
    expose(backgroundAPI, createBackgroundEndpoint(port));
  }
});

console.log("JIXO BG: Background script initialized and listening for connections.");
