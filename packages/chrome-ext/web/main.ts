import {prepareDirHandle, syncInput, syncOutput} from "@jixo/dev/browser";
import {expose} from "comlink";
import {createEndpoint} from "../service-worker/lib/comlink-extension/index.ts";

console.log("JIXO CS: Content script loaded.");
let isSyncActive = false;

// --- API Definition for this Content Script ---
const contentScriptAPI = {
  async selectWorkspace(): Promise<string | null> {
    const dirHandle = await prepareDirHandle();
    return dirHandle.name;
  },
  async startSync(): Promise<{status: "SYNC_STARTED" | "ERROR"; message?: string}> {
    if (isSyncActive) {
      return {status: "ERROR", message: "Sync is already active."};
    }

    const handle = await prepareDirHandle();
    if (!handle) {
      return {status: "ERROR", message: "Workspace not selected. Please call selectWorkspace() first."};
    }

    isSyncActive = true;
    console.log(`JIXO BROWSER: Starting sync with workspace '${handle.name}'...`);

    // These are long-running processes, so we don't await them.
    void syncOutput();
    void syncInput();

    return {status: "SYNC_STARTED"};
  },
  ping() {
    return true;
  },
};

/**
 * Defines the TypeScript interface for the API exposed by the content script.
 * This ensures type safety when the popup or background script calls its methods.
 * It is derived directly from the implementation in `content-script.ts`.
 */
export type ContentScriptAPI = typeof contentScriptAPI;

// --- Connection to Background Script ---
function connectToBackground() {
  // This port is for the background to talk to us.
  const port = chrome.runtime.connect({name: "content-script"});
  // We expose our API on this port.
  expose(contentScriptAPI, createEndpoint(port));
  console.log("JIXO CS: Exposed content script API on port to background.");
}
const main = () => {
  try {
    connectToBackground();
  } catch (error) {
    console.error("JIXO CS: Failed to connect and expose API to background script.", error);
  }
};
main();
