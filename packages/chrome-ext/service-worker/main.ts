import * as Comlink from "comlink";
import {createBackgroundEndpoint} from "./lib/comlink-extension/index.ts";

console.log("JIXO BG: Script start.");

const contentScriptAPIs = new Map<number, chrome.runtime.Port>();

const backgroundAPI = {};
export type BackgroundAPI = typeof backgroundAPI;

chrome.runtime.onConnect.addListener((port) => {
  console.log(`JIXO BG: New connection from '${port.name}'`);

  // The key distinction: connections from content scripts will have a sender.tab property.
  if (port.sender?.tab?.id) {
    const tabId = port.sender.tab.id;
    console.log(`JIXO BG: Connection is from content script in tab ${tabId}. Setting up API proxy.`);

    contentScriptAPIs.set(tabId, port);
    port.onDisconnect.addListener(() => {
      contentScriptAPIs.delete(tabId);
      console.log(`JIXO BG: Unregistered content script for tab ${tabId} due to port disconnect.`);
    });
  } else if (port.name === "popup") {
    // This is a connection from our popup or another part of the extension.
    Comlink.expose(backgroundAPI, createBackgroundEndpoint(port));
  } else if (port.name.startsWith("popup-to-content-script/")) {
    /// 双向转发
    const tabId = parseInt(port.name.split("/").at(-1)!);
    const tabPort = contentScriptAPIs.get(tabId);
    if (!tabPort) {
      port.disconnect();
      return;
    }
    port.onMessage.addListener((msg) => {
      tabPort.postMessage(msg);
    });
    tabPort.onMessage.addListener((msg) => {
      port.postMessage(msg);
    });
    port.onDisconnect.addListener(() => {
      tabPort.disconnect();
    });
    tabPort.onDisconnect.addListener(() => {
      port.disconnect();
    });
  }
});

console.log("JIXO BG: Background script initialized and listening for connections.");
