import {getTargetNamespace, untilDelay} from "@jixo/dev/browser";
import {JIXODraggableDialogElement} from "./draggable-dialog-element.ts";
import {comlinkPrepare} from "./lib/comlink-prepare.ts";

console.log("JIXO CS: MAIN script loaded.");
const initialize = async () => {
  try {
    customElements.define(JIXODraggableDialogElement.is, JIXODraggableDialogElement);
    await comlinkPrepare();
    while (true) {
      await untilDelay(() => getTargetNamespace() !== "new_chat", {timeout: 0});
      const sessionId = getTargetNamespace();
      const ele = JIXODraggableDialogElement.createElement(sessionId);
      document.body.append(ele);
      await untilDelay(() => sessionId !== getTargetNamespace(), {timeout: 0});
      /// 如果sessionId发生改变，那么就移除会话元素
      ele.dispatchEvent(new CustomEvent("destroy"));
      ele.remove();
    }
  } catch (e) {
    console.error("JIXO CS: MAIN initialize failed", e);
  }
};
if (document.readyState === "loading") {
  addEventListener("DOMContentLoaded", initialize);
} else {
  initialize();
}
