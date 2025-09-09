import {func_remember} from "@gaubee/util";
import {easy$} from "@jixo/dev/browser";
import {Comlink} from "@jixo/dev/comlink";
import type {MainContentScriptAPI} from "../main/lib/content-script-api";
import {connectSessionApi} from "./lib/session-websocket";
export const JIXODraggableDialogIsolatedHelper = {
  prepare: func_remember(
    async () => {
      const jixoRootEle = await easy$<HTMLDialogElement>(`jixo-draggable-dialog`, {timeout: 0});
      const sessionId = jixoRootEle.dataset.sessionId;
      if (!sessionId) {
        throw new Error("sessionId not found");
      }
      const mc = new MessageChannel();
      window.postMessage(`jixo-ioslated-connect/${sessionId}`, location.origin, [mc.port2]);
      const mainContentScriptAPI = Comlink.wrap<MainContentScriptAPI>(mc.port1);

      const {sessionApi, destroySessionApi} = await connectSessionApi(sessionId);

      /// 监听销毁事件
      jixoRootEle.addEventListener("destroy" as any, () => {
        destroySessionApi();
        JIXODraggableDialogIsolatedHelper.prepare.reset();
      });

      return {
        sessionId,
        jixoRootEle,
        mainContentScriptAPI,
        sessionApi,
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
  async onOpenChanged(callback: (isOpen: boolean) => void) {
    const {jixoRootEle} = await this.prepare();
    jixoRootEle.addEventListener("beforetoggle", (event) => {
      callback(event.newState === "open");
    });
  },

  async onDestroy(callback: () => void) {
    const {jixoRootEle} = await this.prepare();
    jixoRootEle.addEventListener("destroy" as any, () => {
      callback();
    });
  },

  get afterDestory() {
    const job = Promise.withResolvers<void>();
    this.onDestroy(() => job.resolve());
    return job.promise;
  },
};
