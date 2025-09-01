import * as Comlink from "comlink";
import {createBackgroundEndpoint} from "./lib/comlink-extension/index.ts";

const contentScriptPorts = new Map<number, chrome.runtime.Port>();

export class BackgroundAPI {
  constructor(private port: chrome.runtime.Port) {}
  async getTabId() {
    return this.port.sender?.tab?.id;
  }

  async openSidePanel(tabId?: number) {
    if (tabId != null) {
      console.log("Opening side panel for tab", tabId);
      await chrome.sidePanel.open({tabId: tabId});
    } else {
      const windowId = (await chrome.windows.getCurrent()).id;
      if (windowId != null) {
        chrome.sidePanel.open({windowId: windowId});
      }
    }
  }
}

/**
 * Initializes the Comlink connection listener to route messages.
 */
export function initializeComlink(): void {
  chrome.runtime.onConnect.addListener((port) => {
    console.log(`JIXO BG: New connection from '${port.name}'`);

    // Case 1: A content script is connecting to register itself.
    if (port.name === "content-script" && port.sender?.tab?.id) {
      const tabId = port.sender.tab.id;
      console.log(`JIXO BG: Content script port connected for tab ${tabId}.`);
      contentScriptPorts.set(tabId, port);

      port.onDisconnect.addListener(() => {
        contentScriptPorts.delete(tabId);
        console.log(`JIXO BG: Content script port disconnected for tab ${tabId}.`);
      });
      return; // Registration is complete.
    }

    // Case 2: A popup is connecting to talk to a specific content script.
    if (port.name.startsWith("extensions-to-content-script/")) {
      const tabId = parseInt(port.name.split("/").at(-1)!);
      const contentScriptPort = contentScriptPorts.get(tabId);

      if (!contentScriptPort) {
        console.error(`JIXO BG: Popup tried to connect to non-existent content script for tab ${tabId}.`);
        port.disconnect();
        return;
      }

      // Forward messages in both directions.
      const onPopupMessage = (msg: any) => contentScriptPort.postMessage(msg);
      const onContentScriptMessage = (msg: any) => port.postMessage(msg);

      port.onMessage.addListener(onPopupMessage);
      contentScriptPort.onMessage.addListener(onContentScriptMessage);

      // Clean up listeners when either side disconnects.
      port.onDisconnect.addListener(() => {
        contentScriptPort.onMessage.removeListener(onContentScriptMessage);
        console.log(`JIXO BG: Popup port disconnected from tab ${tabId}.`);
      });
      contentScriptPort.onDisconnect.addListener(() => {
        port.onMessage.removeListener(onPopupMessage);
        console.log(`JIXO BG: Content script port (from popup forward) for tab ${tabId} disconnected.`);
        port.disconnect(); // Also disconnect the popup port
      });
      return;
    }

    // Case 3: A background is connecting to the background itself.
    if (port.name === "background") {
      Comlink.expose(new BackgroundAPI(port), createBackgroundEndpoint(port));
    }
  });

  console.log("JIXO BG: Comlink listeners initialized.");
}
