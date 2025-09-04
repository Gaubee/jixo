import {while$} from "@jixo/dev/browser";
import {JIXODraggableDialogIsolatedHelper} from "./draggable-dialog-isolated.ts";
import {isolatedContentScriptAPI} from "./lib/content-script-api.tsx"; // Fixed import

export async function addToggleButton() {
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
    await isolatedContentScriptAPI.renderComponent("App", null, {});
    if (JIXODraggableDialogIsolatedHelper.isOpend) {
      JIXODraggableDialogIsolatedHelper.closeDialog();
    } else {
      JIXODraggableDialogIsolatedHelper.openDialog();
    }
  });
  JIXODraggableDialogIsolatedHelper.onOpenChanged((opened) => {
    btn.dataset.open = `${opened}`;
  });
  toolbarRightEle.insertBefore(btn, toolbarRightEle.firstElementChild);
  JIXODraggableDialogIsolatedHelper.onDestroy(() => {
    btn.remove();
  });
}
