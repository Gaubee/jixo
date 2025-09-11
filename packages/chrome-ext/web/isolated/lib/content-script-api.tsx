import {PortalContainerCtx} from "@/components/ui/context.ts";
import {pureEvent} from "@gaubee/util";
import type {AgentMetadata} from "@jixo/dev/browser";
import type {} from "@jixo/dev/node";
import React, {useContext, useEffect, useState} from "react";
import {createRoot, type Root} from "react-dom/client";
import {App} from "../components/App.tsx";
import {FunctionCallRenderJobsCtx, IsolatedAPICtx, MainAPICtx, SessionAPICtx, SessionIdCtx, type FunctionCallRenderJob} from "../components/context.ts";
import {JIXODraggableDialogIsolatedHelper} from "../draggable-dialog-isolated.ts";

let reactRootEle: HTMLDivElement | null = null;
let reactRoot: Root | null = null;
const jobResponseListeners = new Map<string, (payload: any) => void>();

async function ensureJixoMainRuntime() {
  const ready = await JIXODraggableDialogIsolatedHelper.prepare();
  if (!reactRoot) {
    const html = String.raw;
    {
      const headerTemplate = document.createElement("template");
      headerTemplate.innerHTML = html`
        <div class="flex min-w-60 flex-row items-center justify-between gap-1 p-2" data-draggable="true" slot="header">
          <h1 class="pointer-events-none text-lg font-bold">JIXO Control Panel</h1>
          <button class="text-red flex aspect-square w-6 cursor-pointer items-center justify-center">✖️</button>
        </div>
      `;
      headerTemplate.content.querySelector("button")!.addEventListener("click", () => {
        ready.jixoRootEle.dataset.open = "false";
      });
      ready.jixoRootEle.appendChild(headerTemplate.content);
    }
    {
      const contentTemplate = document.createElement("template");
      contentTemplate.innerHTML = html`<div slot="content"></div>`;
      reactRootEle = contentTemplate.content.querySelector("div")!;
      ready.jixoRootEle.appendChild(contentTemplate.content);
      reactRoot = createRoot(reactRootEle);
    }
  }
  return {reactRoot, ...ready};
}

window.addEventListener("jixo-user-response", ((event: CustomEvent) => {
  const {jobId, payload} = event.detail;
  const listener = jobResponseListeners.get(jobId);
  if (listener) {
    listener(payload);
    jobResponseListeners.delete(jobId);
    ensureJixoMainRuntime().then(() => {
      JIXODraggableDialogIsolatedHelper.openDialog();
    });
  }
}) as EventListener);

export const isolatedContentScriptAPI = new (class IsolatedContentScriptAPI {
  async ready() {
    await ensureJixoMainRuntime();
  }
  async generateConfigFromMetadata(sessionId: string, metadata: AgentMetadata) {
    const {mainContentScriptAPI, sessionApi} = await ensureJixoMainRuntime();
    const workDirHandle = await mainContentScriptAPI.getWorkspaceHandleName();
    if (!workDirHandle) throw new Error("Workspace not selected.");

    const config = await sessionApi.generateConfigFromMetadata(metadata);

    return config;
  }
  async renderApp() {
    const {reactRoot, mainContentScriptAPI, sessionId, sessionApi} = await ensureJixoMainRuntime();
    // 1. 找到自定义元素
    const host = document.querySelector("jixo-draggable-dialog") as HTMLElement;
    // 2. 把 shadowRoot 作为挂载点
    const shadowHost = host?.shadowRoot ?? null;
    const Render = () => {
      const [jobs, setJobs] = useState(useContext(FunctionCallRenderJobsCtx));
      useEffect(() => {
        this.#onRenderJob((job) => {
          setJobs((jobs) => {
            return [...jobs, job];
          });
        });
      }, []);
      return (
        <FunctionCallRenderJobsCtx.Provider value={jobs}>
          <App />
        </FunctionCallRenderJobsCtx.Provider>
      );
    };

    reactRoot.render(
      <React.StrictMode>
        <PortalContainerCtx.Provider value={shadowHost}>
          <SessionIdCtx.Provider value={sessionId}>
            <MainAPICtx.Provider value={mainContentScriptAPI}>
              <IsolatedAPICtx.Provider value={isolatedContentScriptAPI}>
                <SessionAPICtx.Provider value={sessionApi}>
                  <Render />
                </SessionAPICtx.Provider>
              </IsolatedAPICtx.Provider>
            </MainAPICtx.Provider>
          </SessionIdCtx.Provider>
        </PortalContainerCtx.Provider>
      </React.StrictMode>,
    );
  }

  // @TODO 这里应该存储 job + promise
  #onRenderJob = pureEvent<FunctionCallRenderJob>();
  async renderJob(job: FunctionCallRenderJob): Promise<any> {
    this.#onRenderJob.emit(job);
  }
})();

export type IsolatedContentScriptAPI = typeof isolatedContentScriptAPI;
