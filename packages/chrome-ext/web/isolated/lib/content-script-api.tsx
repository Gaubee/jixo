import React from "react";
import {createRoot, type Root} from "react-dom/client";
import {App} from "../components/App.tsx";
import {AskUserDialog} from "../components/AskUserDialog.tsx";
import {LogThoughtPanel} from "../components/LogThoughtPanel.tsx";
import {ProposePlanDialog} from "../components/ProposePlanDialog.tsx";
import {SubmitChangeSetPanel} from "../components/SubmitChangeSetPanel.tsx";
import {JIXODraggableDialogIsolatedHelper} from "../draggable-dialog-isolated.ts";
import {request as sessionRequest} from "./session-websocket.ts";

let reactRootEle: HTMLDivElement | null = null;
let reactRoot: Root | null = null;
const jobResponseListeners = new Map<string, (payload: any) => void>();

async function ensureJixoMainRuntime() {
  const {jixoRootEle: dialogEle, mainContentScriptAPI} = await JIXODraggableDialogIsolatedHelper.prepare();
  if (!reactRoot) {
    const html = String.raw;
    {
      const headerTemplate = document.createElement("template");
      headerTemplate.innerHTML = html`
        <div class="flex flex-row gap-1 min-w-60 justify-between items-center p-2" data-draggable="true" slot="header">
          <h1 class="text-lg font-bold pointer-events-none">JIXO Control Panel</h1>
          <button class="text-red aspect-square flex items-center justify-center w-6 cursor-pointer">✖️</button>
        </div>
      `;
      headerTemplate.content.querySelector("button")!.addEventListener("click", () => {
        dialogEle.dataset.open = "false";
      });
      dialogEle.appendChild(headerTemplate.content);
    }
    {
      const contentTemplate = document.createElement("template");
      contentTemplate.innerHTML = html`<div slot="content"></div>`;
      reactRootEle = contentTemplate.content.querySelector("div")!;
      dialogEle.appendChild(contentTemplate.content);
      reactRoot = createRoot(reactRootEle);
    }
  }
  return {reactRoot, mainContentScriptAPI};
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
  async generateConfigFromMetadata(metadata: any): Promise<any> {
    const {mainContentScriptAPI} = await ensureJixoMainRuntime();
    const workDirHandle = await mainContentScriptAPI.selectWorkspace();
    if (!workDirHandle) throw new Error("Workspace not selected.");

    const result = await sessionRequest("generateConfigFromMetadata", {
      metadata,
      workDir: workDirHandle,
    });

    await mainContentScriptAPI.writeConfigFile(result, true);
    return result;
  },

  async handleStartSync(): Promise<{status: "SYNC_STARTED" | "ERROR"; message?: string}> {
    const {mainContentScriptAPI} = await ensureJixoMainRuntime();
    return await mainContentScriptAPI.startSync();
  },

  async handleApplyConfig(): Promise<{status: "SUCCESS" | "ERROR"; message?: string}> {
    const {mainContentScriptAPI} = await ensureJixoMainRuntime();
    const config = await mainContentScriptAPI.readConfigFile(false);
    if (!config) {
      return {status: "ERROR", message: "Config file (config.json) not found."};
    }
    await mainContentScriptAPI.applyPageConfig(config);
    return {status: "SUCCESS"};
  },

  async handleApplyTemplate(): Promise<{status: "SUCCESS" | "ERROR"; message?: string}> {
    const {mainContentScriptAPI} = await ensureJixoMainRuntime();
    const templateConfig = await mainContentScriptAPI.readConfigFile(true);
    if (!templateConfig) {
      return {status: "ERROR", message: "Config template not found."};
    }
    await mainContentScriptAPI.writeConfigFile(templateConfig, false);
    return {status: "SUCCESS"};
  },

  async renderComponent(componentName: string, jobId: string | null, props: any): Promise<any> {
    const {reactRoot, mainContentScriptAPI} = await ensureJixoMainRuntime();
    const allProps = {jobId, props, key: jobId || componentName};
    let componentToRender;

    if (jobId) {
      jobResponseListeners.set(jobId, (payload: {data?: any; error?: string}) => {
        if (payload.error) throw new Error(payload.error);
        else return payload.data;
      });
    }

    switch (componentName) {
      case "App":
        componentToRender = <App mainApi={mainContentScriptAPI} isolatedApi={this} />;
        break;
      case "AskUserDialog":
        componentToRender = <AskUserDialog {...(allProps as any)} />;
        break;
      case "LogThoughtPanel":
        componentToRender = <LogThoughtPanel {...allProps} />;
        break;
      case "ProposePlanDialog":
        componentToRender = <ProposePlanDialog {...(allProps as any)} />;
        break;
      case "SubmitChangeSetPanel":
        componentToRender = <SubmitChangeSetPanel {...(allProps as any)} />;
        break;
      default:
        componentToRender = <p>Error: Unknown component '{componentName}'</p>;
    }

    reactRoot.render(<React.StrictMode>{componentToRender}</React.StrictMode>);
    if (!jobId) return true;
  },

  ping() {
    return true;
  },
};

export type IsolatedContentScriptAPI = typeof isolatedContentScriptAPI;
