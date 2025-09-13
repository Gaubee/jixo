import {PortalContainerCtx} from "@/components/ui/context.ts";
import {func_remember, pureEvent} from "@gaubee/util";
import type {AgentMetadata, UIApi} from "@jixo/dev/browser";
import {Comlink} from "@jixo/dev/comlink";
import React, {useEffect, useState} from "react";
import {createRoot, type Root} from "react-dom/client";
import {App} from "../components/App.tsx";
import {FunctionCallRenderJobsCtx, IsolatedAPICtx, MainAPICtx, SessionAPICtx, SessionIdCtx, type FunctionCallRenderJob} from "../components/context.ts";
import {JIXODraggableDialogIsolatedHelper} from "../draggable-dialog-isolated.ts";

let reactRootEle: HTMLDivElement | null = null;
let reactRoot: Root | null = null;
const jobResponseListeners = new Map<string, Comlink.Remote<(payload: any) => void>>();

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

export const isolatedContentScriptAPI = new (class IsolatedContentScriptAPI implements UIApi {
  #onRenderJob = pureEvent<FunctionCallRenderJob>();

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

  renderApp = func_remember(async () => {
    const {reactRoot, mainContentScriptAPI, sessionId, sessionApi} = await ensureJixoMainRuntime();
    const host = document.querySelector("jixo-draggable-dialog") as HTMLElement;
    const shadowHost = host?.shadowRoot ?? null;

    const Render = () => {
      const [jobs, setJobs] = useState<Map<string, FunctionCallRenderJob>>(new Map());

      useEffect(() => {
        const off = this.#onRenderJob((job) => {
          setJobs((prevMap) => {
            const newMap = new Map(prevMap); // 创建 Map 的副本
            newMap.set(job.jobId, job);
            return newMap;
          });
        });
        return () => void off();
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
              <IsolatedAPICtx.Provider value={this}>
                <SessionAPICtx.Provider value={sessionApi}>
                  <Render />
                </SessionAPICtx.Provider>
              </IsolatedAPICtx.Provider>
            </MainAPICtx.Provider>
          </SessionIdCtx.Provider>
        </PortalContainerCtx.Provider>
      </React.StrictMode>,
    );
  });

  async renderJob(jobId: string, componentName: string, props: any) {
    console.log("Received render job via RPC:", {jobId, componentName, props});
    const renderJob: FunctionCallRenderJob = {
      jobId,
      componentName,
      props,
      resolvers: Promise.withResolvers(),
      finished: false,
    };
    this.#onRenderJob.emit(renderJob);
    return renderJob.resolvers.promise.then(
      (result) => {
        renderJob.finished = "SUCCESS";
        return {success: true, result};
      },
      (error) => {
        renderJob.finished = "ERROR";
        return {success: false, error};
      },
    );
  }
})();

export type IsolatedContentScriptAPI = typeof isolatedContentScriptAPI;
