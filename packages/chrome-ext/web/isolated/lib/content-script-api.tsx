import type {AgentMetadata} from "@jixo/dev/browser";
import type {} from "@jixo/dev/node";
import React from "react";
import {createRoot, type Root} from "react-dom/client";
import {App} from "../components/App.tsx";
import {AskUserDialog} from "../components/AskUserDialog.tsx";
import {IsolatedAPICtx, MainAPICtx, SessionAPICtx, SessionIdCtx} from "../components/context.ts";
import {LogThoughtPanel} from "../components/LogThoughtPanel.tsx";
import {ProposePlanDialog} from "../components/ProposePlanDialog.tsx";
import {SubmitChangeSetPanel} from "../components/SubmitChangeSetPanel.tsx";
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

export const isolatedContentScriptAPI = {
  async generateConfigFromMetadata(sessionId: string, metadata: AgentMetadata): Promise<any> {
    const {mainContentScriptAPI, sessionApi} = await ensureJixoMainRuntime();
    const workDirHandle = await mainContentScriptAPI.getWorkspaceHandleName();
    if (!workDirHandle) throw new Error("Workspace not selected.");

    const config = await sessionApi.generateConfigFromMetadata(metadata);

    await mainContentScriptAPI.writeConfigFile(sessionId, true, JSON.stringify(config, null, 2));
    return config;
  },

  async handleStartSync(): Promise<{status: "SYNC_STARTED" | "ERROR"; message?: string}> {
    const {mainContentScriptAPI} = await ensureJixoMainRuntime();
    return mainContentScriptAPI.startSync();
  },

  async renderComponent(componentName: string, jobId: string | null, props: any): Promise<any> {
    const {reactRoot, mainContentScriptAPI, sessionId, sessionApi} = await ensureJixoMainRuntime();
    const allProps = {jobId, props, key: jobId || componentName};

    if (jobId) {
      jobResponseListeners.set(jobId, (payload: {data?: any; error?: string}) => {
        if (payload.error) throw new Error(payload.error);
        else return payload.data;
      });
    }

    const Render = () => {
      switch (componentName) {
        case "App":
          return <App mainApi={mainContentScriptAPI} isolatedApi={this} />;
          break;
        case "AskUserDialog":
          return <AskUserDialog {...(allProps as any)} />;
          break;
        case "LogThoughtPanel":
          return <LogThoughtPanel {...allProps} />;
          break;
        case "ProposePlanDialog":
          return <ProposePlanDialog {...(allProps as any)} />;
          break;
        case "SubmitChangeSetPanel":
          return <SubmitChangeSetPanel {...(allProps as any)} />;
          break;
        default:
          return <p>Error: Unknown component '{componentName}'</p>;
      }
    };

    reactRoot.render(
      <React.StrictMode>
        <SessionIdCtx.Provider value={sessionId}>
          <MainAPICtx.Provider value={mainContentScriptAPI}>
            <IsolatedAPICtx.Provider value={isolatedContentScriptAPI}>
              <SessionAPICtx.Provider value={sessionApi}>
                <Render />
              </SessionAPICtx.Provider>
            </IsolatedAPICtx.Provider>
          </MainAPICtx.Provider>
        </SessionIdCtx.Provider>
      </React.StrictMode>,
    );
    if (!jobId) return true;
  },

  ping() {
    return true;
  },
};

export type IsolatedContentScriptAPI = typeof isolatedContentScriptAPI;
