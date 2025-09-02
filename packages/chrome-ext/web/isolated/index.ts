import * as Comlink from "comlink";
import {createEndpoint} from "../../service-worker/lib/comlink-extension/index.ts";
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
    await JIXODraggableDialogIsolatedHelper.prepare();
    addToggleButton();
  } catch (e) {
    console.error("JIXO CS: ISOLATED initialize failed", e);
  }
}

initialize();
