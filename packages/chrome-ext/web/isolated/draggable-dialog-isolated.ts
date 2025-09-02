import {func_remember} from "@gaubee/util";
import {easy$} from "@jixo/dev/browser";
import * as Comlink from "comlink";
import type {MainContentScriptAPI} from "../main/lib/content-script-api";
export const JIXODraggableDialogIsolatedHelper = {
  prepare: func_remember(
    async () => {
      const jixoRootEle = await easy$<HTMLDialogElement>(`jixo-draggable-dialog`, 0);
      const mc = new MessageChannel();
      window.postMessage("jixo-ioslated-connect", location.origin, [mc.port2]);
      const mainContentScriptAPI = Comlink.wrap<MainContentScriptAPI>(mc.port1);
      return {
        jixoRootEle,
        mainContentScriptAPI,
      };
    },
    undefined,
    true,
  ),
  async openDialog() {
    const {jixoRootEle} = await this.prepare();
    jixoRootEle.dataset.open = "true";
  },
  async closeDialog() {
    const {jixoRootEle} = await this.prepare();
    jixoRootEle.dataset.open = "false";
  },
  get isOpend() {
    const {awaitedReturnValue} = this.prepare;
    return awaitedReturnValue?.type == "resolved" && awaitedReturnValue.result.jixoRootEle.dataset.open === "true";
  },
};
