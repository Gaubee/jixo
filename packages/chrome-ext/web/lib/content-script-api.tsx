import {getEasyFs, getTargetNamespace, prepareDirHandle, setFunctionCallTools, setModel, setSystemPrompt, syncInput, syncOutput} from "@jixo/dev/browser";
import React from "react";
import {createRoot, type Root} from "react-dom/client";
import {z} from "zod";
import {App} from "../components/App.tsx";
import {AskUserDialog} from "../components/AskUserDialog.tsx";
import {LogThoughtPanel} from "../components/LogThoughtPanel.tsx";
import {ProposePlanDialog} from "../components/ProposePlanDialog.tsx";
import {SubmitChangeSetPanel} from "../components/SubmitChangeSetPanel.tsx";
import {JIXODraggableDialogElement} from "../draggable-dialog.ts";
import {storeWorkspaceHandle} from "./workspace.ts";

const ConfigSchema = z
  .object({
    systemPrompt: z.string().optional(),
    tools: z.array(z.any()).optional(),
    model: z.string().optional(),
  })
  .partial();

let dialogInstance: JIXODraggableDialogElement | null = null;
let reactRoot: Root | null = null;
const jobResponseListeners = new Map<string, (payload: any) => void>();

function ensureDialog(): JIXODraggableDialogElement {
  if (!dialogInstance) {
    dialogInstance = JIXODraggableDialogElement.createElement();
    dialogInstance.appendTo(document.body);
    const container = document.createElement("div");
    dialogInstance.setContent(container);
    reactRoot = createRoot(container);
  }
  return dialogInstance;
}

window.addEventListener("jixo-user-response", ((event: CustomEvent) => {
  const {jobId, payload} = event.detail;
  const listener = jobResponseListeners.get(jobId);
  if (listener) {
    listener(payload);
    jobResponseListeners.delete(jobId);
    ensureDialog().closeDialog();
  }
}) as EventListener);

export const contentScriptAPI = {
  async selectWorkspace(): Promise<string | null> {
    const dirHandle = await prepareDirHandle();
    await storeWorkspaceHandle(dirHandle);
    return dirHandle.name;
  },
  async startSync(): Promise<{status: "SYNC_STARTED" | "ERROR"; message?: string}> {
    const handle = await prepareDirHandle();
    if (!handle) return {status: "ERROR", message: "Workspace not selected."};
    // Fixed: syncOutput/syncInput no longer take a handle argument.
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
  renderComponent(componentName: string, jobId: string | null, props: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const dialog = ensureDialog();
      if (!reactRoot) return reject(new Error("React root not initialized."));

      const finalJobId = jobId || `display-only-${Date.now()}`;
      const allProps = {jobId: finalJobId, props, key: finalJobId};
      let componentToRender;

      if (jobId) {
        // Only set up listeners for interactive components
        jobResponseListeners.set(jobId, (payload) => {
          if (payload.error) reject(new Error(payload.error));
          else resolve(payload.data);
        });
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
          componentToRender = <AskUserDialog {...allProps} />;
          break;
        case "LogThoughtPanel":
          componentToRender = <LogThoughtPanel {...allProps} />;
          break;
        case "ProposePlanDialog":
          componentToRender = <ProposePlanDialog {...allProps} />;
          break;
        case "SubmitChangeSetPanel":
          componentToRender = <SubmitChangeSetPanel {...allProps} />;
          break;
        default:
          componentToRender = <div>Error: Unknown component '{componentName}'</div>;
      }

      reactRoot.render(<React.StrictMode>{componentToRender}</React.StrictMode>);
      dialog.openDialog();

      if (!jobId) resolve(true); // Non-interactive components resolve immediately
    });
  },
  ping() {
    return true;
  },
};
export type ContentScriptAPI = typeof contentScriptAPI;
