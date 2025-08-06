import type {FsDuplexBrowserHelper} from "./browser.js";
import {BrowserFsDuplex} from "./browser.js";
import {superjson} from "./superjson.js";

declare global {
  interface Window {
    harness: BrowserTestHarness;
  }
}

class BrowserHelper implements FsDuplexBrowserHelper {
  constructor(private directoryHandle: FileSystemDirectoryHandle) {
    if (!directoryHandle) throw new Error("BrowserHelper requires a valid DirectoryHandle.");
  }
  async getFileHandle(filename: string): Promise<FileSystemFileHandle> {
    return this.directoryHandle.getFileHandle(filename, {create: true});
  }
}

class BrowserTestHarness {
  public duplex: BrowserFsDuplex<any, "handler"> | null = null;
  private directoryHandle: FileSystemDirectoryHandle | null = null;
  private logContainer: HTMLElement | null = null;
  private statusHeader: HTMLElement | null = null;
  private actionButton: HTMLButtonElement | null = null;

  constructor() {
    this.logContainer = document.getElementById("log-container");
    this.statusHeader = document.getElementById("status-header");
    this.actionButton = document.getElementById("action-button") as HTMLButtonElement;
    this.logEventToUI("Harness Initialized. Waiting for Node.js.", "event");
  }

  public async initialize(filenamePrefix: string) {
    this.actionButton!.disabled = true;

    try {
      if (!this.directoryHandle) {
        this.updateStatus("Requesting directory access...", "ready");
        this.logEventToUI("Waiting for user to select directory...", "event");
        this.directoryHandle = await window.showDirectoryPicker({mode: "readwrite"});
        this.logEventToUI(`Directory handle for "${this.directoryHandle.name}" obtained.`, "event");
      }

      this.updateStatus(`Initializing FsDuplex for "${this.directoryHandle.name}"...`, "ready");

      if (this.duplex) {
        await this.duplex.stop();
      }
      const helper = new BrowserHelper(this.directoryHandle);
      this.duplex = new BrowserFsDuplex("handler", superjson, filenamePrefix, helper);

      this.duplex.onOpen.on(() => {
        this.logEvent("open");
        this.logEventToUI("Connection OPEN.", "event");
        this.updateStatus("Connection Active", "running");
      });
      this.duplex.onClose.on((reason) => {
        this.logEvent("close", reason);
        this.logEventToUI(`Connection CLOSED. Reason: ${reason}`, "event");
        this.updateStatus(`Connection Closed. Ready for next step.`, "closed");
        this.actionButton!.disabled = false;
      });
      this.duplex.onData.on((payload) => {
        this.logEvent("data", payload);
        this.logEventToUI(JSON.stringify(payload), "in");
      });
      this.duplex.onError.on((error) => {
        this.logEvent("error", {message: error.message});
        this.logEventToUI(`ERROR: ${error.message}`, "event");
        this.updateStatus(`Error: ${error.message}`, "closed");
      });

      await this.duplex.start();
      this.logEventToUI("BrowserFsDuplex started, waiting for handshake.", "event");
      this.logEvent("initialized"); // Signal to Node.js
    } catch (err: any) {
      this.updateStatus(`Error: ${err.message}`, "closed");
      this.logEventToUI(`Initialization failed: ${err.message}`, "event");
      this.actionButton!.disabled = false;
    }
  }

  private logEventToUI(message: string, type: "in" | "out" | "event") {
    if (!this.logContainer) return;
    const entry = document.createElement("div");
    entry.className = `log-entry ${type}`;
    entry.textContent = message;
    this.logContainer.appendChild(entry);
    this.logContainer.scrollTop = this.logContainer.scrollHeight;
  }

  private updateStatus(message: string, state: "ready" | "running" | "closed") {
    if (!this.statusHeader) return;
    this.statusHeader.textContent = message;
    this.statusHeader.className = `status-${state}`;
  }

  public logEvent(event: string, payload?: any) {
    console.log(`__HARNESS_EVENT__:${JSON.stringify({event, payload})}`);
  }
}

window.harness = new BrowserTestHarness();
