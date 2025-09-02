import {JIXODraggableDialogElement} from "./draggable-dialog-element.ts";
import {comlinkPrepare} from "./lib/comlink-prepare.ts";

console.log("JIXO CS: MAIN script loaded.");
const initialize = async () => {
  try {
    customElements.define(JIXODraggableDialogElement.is, JIXODraggableDialogElement);
    await comlinkPrepare();
    document.body.append(JIXODraggableDialogElement.createElement());
  } catch (e) {
    console.error("JIXO CS: MAIN initialize failed", e);
  }
};
if (document.readyState === "loading") {
  addEventListener("DOMContentLoaded", initialize);
} else {
  initialize();
}
