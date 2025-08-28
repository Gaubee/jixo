// packages/chrome-ext/src/content-script.ts
import {startSync} from "./lib/sync-logic.ts";
import {getWorkspaceHandle} from "./lib/workspace.ts";

console.log("JIXO AI Tools content script loaded and waiting for commands.");

// Listen for a message from the popup to start the sync process.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "START_SYNC") {
    console.log("JIXO CS: Received START_SYNC command.");
    (async () => {
      const handle = await getWorkspaceHandle();
      if (handle) {
        await startSync(handle);
        sendResponse({status: "SYNC_STARTED"});
      } else {
        sendResponse({status: "ERROR", message: "Workspace handle not found."});
      }
    })();
    return true; // Indicates async response
  }
});
