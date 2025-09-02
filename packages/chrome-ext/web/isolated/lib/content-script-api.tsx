import React from "react";
import {createRoot, type Root} from "react-dom/client";
import {z} from "zod";
import {App} from "../components/App.tsx";
import {AskUserDialog} from "../components/AskUserDialog.tsx";
import {LogThoughtPanel} from "../components/LogThoughtPanel.tsx";
import {ProposePlanDialog} from "../components/ProposePlanDialog.tsx";
import {SubmitChangeSetPanel} from "../components/SubmitChangeSetPanel.tsx";
import {JIXODraggableDialogIsolatedHelper} from "../draggable-dialog-isolated.ts";

const ConfigSchema = z
  .object({
    systemPrompt: z.string().optional(),
    tools: z.array(z.any()).optional(),
    model: z.string().optional(),
  })
  .partial();

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

// Listen for responses from the React components via a global custom event.
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

// --- API Definition ---
export const isolatedContentScriptAPI = {
  async renderComponent(componentName: string, jobId: string | null, props: any): Promise<any> {
    const {reactRoot, mainContentScriptAPI} = await ensureJixoMainRuntime();

    const allProps = {jobId, props, key: jobId || componentName};
    let componentToRender;

    if (jobId) {
      const listener = (payload: {data?: any; error?: string}) => {
        if (payload.error) throw new Error(payload.error);
        else return payload.data;
      };
      jobResponseListeners.set(jobId, listener);
    }

    switch (componentName) {
      case "App":
        componentToRender = <App api={mainContentScriptAPI} />;
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
