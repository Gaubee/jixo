import {selectWorkspace as browserSelectWorkspace, startSync as browserStartSync} from "@jixo/dev/browser";
import {expose} from "comlink";
import {createEndpoint} from "comlink-extension";
import {storeWorkspaceHandle} from "./lib/workspace.ts";

console.log("JIXO CS: Content script loaded.");

// --- API Definition for this Content Script ---
export const contentScriptAPI = {
  async selectWorkspace(): Promise<string | null> {
    const handle = await browserSelectWorkspace();
    // We now store the handle directly from the browser lib call, but this API returns the name.
    await storeWorkspaceHandle(handle);
    return handle.name;
  },
  async startSync(): Promise<{status: string; message?: string}> {
    return await browserStartSync();
  },
  ping() {
    return true;
  },
};

// --- Connection to Background Script ---
function connectToBackground() {
  // This port is for the background to talk to us.
  const port = chrome.runtime.connect({name: "content-script"});
  // We expose our API on this port.
  expose(contentScriptAPI, createEndpoint(port));
  console.log("JIXO CS: Exposed content script API on port to background.");
}

try {
  connectToBackground();
} catch (error) {
  console.error("JIXO CS: Failed to connect and expose API to background script.", error);
}
