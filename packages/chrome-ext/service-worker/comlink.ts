import {createBackgroundEndpoint} from "@/lib/comlink-extension/index.ts";
import {Comlink} from "@jixo/dev/comlink";
import {sidePanelAPI} from "./sidepanel.ts";
import {createSessionWebSocket, globalWebSocket} from "./websocket.ts";

export const contentScriptPorts = new Map<number, chrome.runtime.Port>();

export class BackgroundAPI {
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
    } else if (port.name.startsWith("ws-session:")) {
      const sessionId = port.name.split(":")[1];
      createSessionWebSocket(sessionId, port);
    }
  });

  console.log("JIXO BG: Comlink listeners initialized.");
  return {backgroundAPI: backgroundApiInstance, contentScriptPorts};
}
