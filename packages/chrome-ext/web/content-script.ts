import {getEasyFs, getTargetNamespace, prepareDirHandle, setFunctionCallTools, setModel, setSystemPrompt, syncInput, syncOutput, while$} from "@jixo/dev/browser";
import * as Comlink from "comlink";
import {z} from "zod";
import type {BackgroundAPI} from "../service-worker/comlink.ts";
import {createEndpoint} from "../service-worker/lib/comlink-extension/index.ts";
import {JIXODraggableDialogElement} from "./draggable-dialog.ts";

console.log("JIXO CS: Content script loaded.");
let isSyncActive = false;

// Define a schema for our config file for safe parsing.
const ConfigSchema = z
  .object({
    systemPrompt: z.string().optional(),
    tools: z.array(z.any()).optional(), // Keeping tools flexible for now
    model: z.string().optional(),
  })
  .partial();

// --- API Definition for this Content Script ---
const contentScriptAPI = {
  async selectWorkspace(): Promise<string | null> {
    const dirHandle = await prepareDirHandle();
    return dirHandle.name;
  },
  async startSync(): Promise<{status: "SYNC_STARTED" | "ERROR"; message?: string}> {
    if (isSyncActive) {
      return {status: "ERROR", message: "Sync is already active."};
    }
    const handle = await prepareDirHandle();
    if (!handle) {
      return {status: "ERROR", message: "Workspace not selected. Please call selectWorkspace() first."};
    }
    isSyncActive = true;
    console.log(`JIXO BROWSER: Starting sync with workspace '${handle.name}'...`);
    void syncOutput();
    void syncInput();
    return {status: "SYNC_STARTED"};
  },

  /**
   * Reads config.json from the workspace and applies its settings to the page.
   */
  async applyConfig(): Promise<{status: "SUCCESS" | "ERROR"; message?: string; appliedSettings: string[]}> {
    try {
      const fs = await getEasyFs();
      const configPath = `${getTargetNamespace()}.config.json`;

      if (!(await fs.exists(configPath))) {
        const templatePath = `${getTargetNamespace()}.config-template.json`;
        if (!(await fs.exists(templatePath))) {
          return {status: "ERROR", message: `Neither ${configPath} nor ${templatePath} found.`, appliedSettings: []};
        }
        // If template exists but config doesn't, copy it.
        const templateContent = await fs.readFileText(templatePath);
        await fs.writeFile(configPath, templateContent);
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
      console.error("JIXO CS: Error applying config:", error);
      return {status: "ERROR", message: error.message, appliedSettings: []};
    }
  },

  ping() {
    return true;
  },
};

export type ContentScriptAPI = typeof contentScriptAPI;

// --- Connection to Background Script ---
function exposeContentApiToBackground() {
  const port = chrome.runtime.connect({name: "content-script"});
  Comlink.expose(contentScriptAPI, createEndpoint(port));
  console.log("JIXO CS: Exposed content script API on port to background.");
}

async function addSidepanelToggleButton(backgroundApi: Comlink.Remote<BackgroundAPI>) {
  const toolbarRightEle = await while$("ms-toolbar .toolbar-right", 0);
  const template = document.createElement("template");
  const html = String.raw;
  template.innerHTML = html`
    <button
      style="display: flex;
    background: transparent;
    border: none;
    cursor: pointer;"
    >
      <img style="width:20px" src="${chrome.runtime.getURL("icons/icon128.png")}" />
    </button>
  `;
  const btn = template.content.querySelector("button")!;
  btn.addEventListener("click", () => {
    // backgroundApi.openSidePanel();
    showDialog();
  });
  toolbarRightEle.insertBefore(template.content, toolbarRightEle.firstElementChild);
}

async function showDialog() {
  let dialogEle = JIXODraggableDialogElement.$();
  if (dialogEle == null) {
    dialogEle = JIXODraggableDialogElement.createElement();
  }
  if (dialogEle.dataset.readyState != "complete") {
    dialogEle.dataset.readyState = "complete";
    const html = String.raw;
    const css = String.raw;
    {
      const headerTemplate = document.createElement("template");
      headerTemplate.innerHTML = html`
        <div data-draggable="true" class="title-bar">
          我的浮动对话框
          <button class="close-btn">✖️</button>
        </div>
      `;
      headerTemplate.content.querySelector(".close-btn")!.addEventListener("click", () => {
        dialogEle.closeDialog();
      });
      dialogEle.setHeader(headerTemplate.content);
    }
    {
      const contentTemplate = document.createElement("template");
      contentTemplate.innerHTML = html` <div class="content-body">
        <p>这是一个使用 Web Component 构建的可拖拽对话框。</p>
        <p>它会自动吸附到窗口边缘，并在窗口大小改变时重新定位。</p>
        <p>背景使用了液态玻璃特效。</p>
        <p>你可以通过 CSS Parts 定制它的样式。</p>
        <button class="action-button">点击我</button>
      </div>`;
      dialogEle.setContent(contentTemplate.content);
      dialogEle.setCss(css`
        .title-bar {
          cursor: grab;
          padding: 12px 16px;
          font-weight: bold;
          background: rgba(255, 255, 255, 0.1);
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          color: #333;
          display: flex;
          flex-direction: row;
        }
        .close-btn {
          margin-left: auto;
          background: transparent;
          border: none;
          cursor: pointer;
          font-size: 16px;
          line-height: 1;
          color: #666;
        }
        .content-body {
          padding: 12px;
          color: #333;
          font-size: 14px;
          line-height: 1.5;
        }
        .action-button {
          margin-top: 10px;
          padding: 8px 12px;
          border: none;
          border-radius: 10px;
          background: #007bff;
          color: white;
          cursor: pointer;
        }
      `);
    }
    dialogEle.appendTo(document.body);
  }
  dialogEle.toggleDialog();
}

const prepare = () => {
  JIXODraggableDialogElement.prepare();
};
const main = async () => {
  const myElement = document.createElement("my-element");
  document.body.prepend(myElement);

  const port = chrome.runtime.connect({name: "background"});
  const backgroundApi = Comlink.wrap<BackgroundAPI>(createEndpoint(port));
  await addSidepanelToggleButton(backgroundApi);
};

try {
  exposeContentApiToBackground();
  prepare();

  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", main);
  } else {
    main();
  }
} catch (error) {
  console.error("JIXO CS: Failed to connect and expose API to background script.", error);
}
