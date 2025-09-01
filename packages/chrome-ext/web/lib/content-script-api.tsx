import {getEasyFs, getTargetNamespace, prepareDirHandle, setFunctionCallTools, setModel, setSystemPrompt, syncInput, syncOutput} from "@jixo/dev/browser";
import React from "react";
import {createRoot, type Root} from "react-dom/client";
import {z} from "zod";
import {App} from "../components/App.tsx";
import {AskUserDialog} from "../components/AskUserDialog.tsx";
import {LogThoughtPanel} from "../components/LogThoughtPanel.tsx";
import {ProposePlanDialog} from "../components/ProposePlanDialog.tsx";
import {SubmitChangeSetPanel} from "../components/SubmitChangeSetPanel.tsx";
import {JIXODraggableDialogIsolatedHelper} from "../draggable-dialog.isolated.ts";
import {storeWorkspaceHandle} from "./workspace.ts";

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

async function ensureDialog() {
  const dialogEle = await JIXODraggableDialogIsolatedHelper.prepare();
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
  return dialogEle;
}

// Listen for responses from the React components via a global custom event.
window.addEventListener("jixo-user-response", ((event: CustomEvent) => {
  const {jobId, payload} = event.detail;
  const listener = jobResponseListeners.get(jobId);
  if (listener) {
    listener(payload);
    jobResponseListeners.delete(jobId);
    ensureDialog().then((dialogEle) => {
      dialogEle.dataset.open = "true";
    });
  }
}) as EventListener);

// --- API Definition ---
export const contentScriptAPI = {
  async selectWorkspace(): Promise<string | null> {
    const dirHandle = await prepareDirHandle();
    await storeWorkspaceHandle(dirHandle);
    return dirHandle.name;
  },
  async startSync(): Promise<{status: "SYNC_STARTED" | "ERROR"; message?: string}> {
    const handle = await prepareDirHandle();
    if (!handle) return {status: "ERROR", message: "Workspace not selected."};
    console.log(`JIXO BROWSER: Starting sync with workspace '${handle.name}'...`);
    void syncOutput();
    void syncInput();
    return {status: "SYNC_STARTED"};
  },
  async applyConfig(): Promise<{status: "SUCCESS" | "ERROR"; message?: string; appliedSettings: string[]}> {
    try {
      const fs = await getEasyFs();
      const configPath = `${getTargetNamespace()}.config.json`;
      if (!(await fs.exists(configPath))) {
        const templatePath = `${getTargetNamespace()}.config-template.json`;
        if (await fs.exists(templatePath)) {
          const templateContent = await fs.readFileText(templatePath);
          await fs.writeFile(configPath, templateContent);
        } else {
          return {status: "ERROR", message: `Config file not found: ${configPath}`, appliedSettings: []};
        }
      }
      const configContent = await fs.readFileText(configPath);
      const config = ConfigSchema.parse(JSON.parse(configContent));
      const appliedSettings: string[] = [];
      if (config.systemPrompt) {
        await setSystemPrompt(config.systemPrompt);
        appliedSettings.push("systemPrompt");
      }
      if (config.tools) {
        await setFunctionCallTools(config.tools);
        appliedSettings.push("tools");
      }
      if (config.model) {
        await setModel(config.model);
        appliedSettings.push("model");
      }
      return {status: "SUCCESS", appliedSettings};
    } catch (error: any) {
      return {status: "ERROR", message: error.message, appliedSettings: []};
    }
  },

  async renderComponent(componentName: string, jobId: string | null, props: any): Promise<any> {
    const dialog = await ensureDialog();
    if (!reactRoot) throw new Error("React root not initialized.");

    const allProps = {jobId, props, key: jobId || componentName};
    let componentToRender;

    if (jobId) {
      const listener = (payload: {data?: any; error?: string}) => {
        if (payload.error) throw new Error(payload.error);
        else return payload.data;
      };
      jobResponseListeners.set(jobId, listener);
    }

    const apiForComponents = {
      selectWorkspace: this.selectWorkspace,
      startSync: this.startSync,
      applyConfig: this.applyConfig,
    };

    switch (componentName) {
      case "App":
        componentToRender = <App api={apiForComponents} />;
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
    if (dialog.dataset.open != "true") {
      dialog.dataset.open = "true";
    } else {
      dialog.dataset.open = "false";
    }

    if (!jobId) return true;
  },

  ping() {
    return true;
  },
};

export type ContentScriptAPI = typeof contentScriptAPI;
