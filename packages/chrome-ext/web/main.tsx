import {while$} from "@jixo/dev/browser";
import * as Comlink from "comlink";
import {createEndpoint} from "../service-worker/lib/comlink-extension/index.ts";
import {JIXODraggableDialogIsolatedHelper} from "./draggable-dialog.isolated.ts";
import {contentScriptAPI} from "./lib/content-script-api.tsx"; // Fixed import

console.log("JIXO CS: Main script loaded.");

function exposeApiToBackground() {
  const port = chrome.runtime.connect({name: "content-script"});
  Comlink.expose(contentScriptAPI, createEndpoint(port));
  console.log("JIXO CS: Exposed content script API to background.");
}

async function addToggleButton() {
  const toolbarRightEle = await while$("ms-toolbar .toolbar-right", 0);
  const template = document.createElement("template");

  const html = String.raw;
  template.innerHTML = html`
    <button
      class="jixo-toggle-button"
      title="Toggle JIXO Panel"
      style="
        display: flex; background: transparent; border: none; cursor: pointer; padding: 4px;"
    >
      <img style="width:20px" src="${chrome.runtime.getURL("icons/icon128.png")}" />
    </button>
  `;
  const btn = template.content.querySelector("button")!;
  btn.addEventListener("click", () => {
    contentScriptAPI.renderComponent("App", null, {});
  });
  toolbarRightEle.insertBefore(template.content, toolbarRightEle.firstElementChild);
}

async function initialize() {
  exposeApiToBackground();
  await JIXODraggableDialogIsolatedHelper.prepare();
  addToggleButton();
}

initialize();
