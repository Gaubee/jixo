import {initializeComlink} from "./comlink.ts";
import {initializeSidePanel} from "./sidepanel.ts";
import {initializeWebSocket} from "./websocket.ts";

console.log("JIXO BG: Service Worker starting up...");

const {backgroundAPI, contentScriptPorts} = initializeComlink();
initializeSidePanel(contentScriptPorts);
initializeWebSocket(backgroundAPI);

console.log("JIXO BG: All services initialized.");

export type {BackgroundAPI} from "./comlink.ts";

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (tab.url && tab.url.startsWith("https://aistudio.google.com/")) {
    try {
      await chrome.scripting.executeScript({
        target: {tabId: tabId},
        files: ["web-inject.js"],
        world: "MAIN",
      });
    } catch (e) {
      console.error("QAQ", e);
    }
  } else {
  }
});
