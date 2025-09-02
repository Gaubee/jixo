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

async function addToggleButton(jixoRoot: HTMLElement) {
  const toolbarRightEle = await while$("ms-toolbar .toolbar-right", 0);
  const template = document.createElement("template");

  const html = String.raw;
  template.innerHTML = html`
    <button class="jixo-toggle-button" title="Toggle JIXO Panel">
      <img style="width:20px" src="${chrome.runtime.getURL("icons/icon128.png")}" />
    </button>
  `;
  const cssSheet = new CSSStyleSheet();
  const css = String.raw;
  cssSheet.replaceSync(css`
    .jixo-toggle-button {
      display: flex;
      background: transparent;
      border: none;
      cursor: pointer;
      padding: 4px;
      border-radius: 50%;
      &:hover {
        background: rgb(0 0 0 / 5%);
      }
      &[data-open="true"] {
        box-shadow: inset 0 0 8px rgb(51 164 159 / 50%);
      }
    }
  `);
  document.adoptedStyleSheets.push(cssSheet);

  const btn = template.content.querySelector("button")!;
  btn.addEventListener("click", async () => {
    await contentScriptAPI.renderComponent("App", null, {});
    if (JIXODraggableDialogIsolatedHelper.isOpend) {
      JIXODraggableDialogIsolatedHelper.closeDialog();
      btn.dataset.open = "false";
    } else {
      JIXODraggableDialogIsolatedHelper.openDialog();
      btn.dataset.open = "true";
    }
  });
  toolbarRightEle.insertBefore(template.content, toolbarRightEle.firstElementChild);
}

async function initialize() {
  exposeApiToBackground();
  const jixoRoot = await JIXODraggableDialogIsolatedHelper.prepare();
  addToggleButton(jixoRoot);
}

initialize();
