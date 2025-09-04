import {createEndpoint} from "@/lib/comlink-extension/index.ts";
import {Comlink} from "@jixo/dev/comlink";
import {JIXODraggableDialogIsolatedHelper} from "./draggable-dialog-isolated.ts";
import {isolatedContentScriptAPI} from "./lib/content-script-api.tsx"; // Fixed import
import {addToggleButton} from "./toggle-button-element.ts";

console.log("JIXO CS: ISOLATED script loaded.");

function exposeApiToBackground() {
  const port = chrome.runtime.connect({name: "content-script"});
  Comlink.expose(isolatedContentScriptAPI, createEndpoint(port));
  console.log("JIXO CS: Exposed content script API to background.");
}

async function initialize() {
  try {
    exposeApiToBackground();
    while (true) {
      await JIXODraggableDialogIsolatedHelper.prepare();
      await addToggleButton();
      await JIXODraggableDialogIsolatedHelper.afterDestory;
    }
  } catch (e) {
    console.error("JIXO CS: ISOLATED initialize failed", e);
  }
}

initialize();
