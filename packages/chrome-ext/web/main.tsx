import {while$} from "@jixo/dev/browser";
import * as Comlink from "comlink";
import {createEndpoint} from "../service-worker/lib/comlink-extension/index.ts";
import {JIXODraggableDialogElement} from "./draggable-dialog.ts";
import {contentScriptAPI} from "./lib/content-script-api.tsx"; // Fixed import

console.log("JIXO CS: Main script loaded.");

function exposeApiToBackground() {
  const port = chrome.runtime.connect({name: "content-script"});
  Comlink.expose(contentScriptAPI, createEndpoint(port));
  console.log("JIXO CS: Exposed content script API to background.");
}

async function addToggleButton() {
  const toolbarRightEle = await while$("ms-toolbar .toolbar-right");
  const btn = document.createElement("button");
  btn.style.cssText = "display: flex; background: transparent; border: none; cursor: pointer; padding: 4px;";
  btn.title = "Toggle JIXO Panel";
  btn.innerHTML = `<img style="width:20px" src="${chrome.runtime.getURL("icons/icon128.png")}" />`;
  btn.addEventListener("click", () => {
    contentScriptAPI.renderComponent("App", null, {});
  });
  toolbarRightEle.insertBefore(btn, toolbarRightEle.firstElementChild);
}

function initialize() {
  JIXODraggableDialogElement.prepare();
  exposeApiToBackground();

  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", addToggleButton);
  } else {
    addToggleButton();
  }
}

initialize();
