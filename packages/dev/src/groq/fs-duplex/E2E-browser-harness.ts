import type {FsDuplexBrowserHelper} from "./browser.js";
import {BrowserFsDuplex} from "./browser.js";
import {superjson} from "./superjson.js";

declare global {
  interface Window {
    harness: BrowserTestHarness;
  }
}

// A simple in-memory cache for file handles to improve performance
const fileHandleCache = new Map<string, FileSystemFileHandle>();

/**
 * Implements the FsDuplexBrowserHelper using a directory handle
 * obtained via the File System Access API.
 */
class BrowserHelper implements FsDuplexBrowserHelper {
  constructor(private directoryHandle: FileSystemDirectoryHandle) {
    if (!directoryHandle) {
      throw new Error("BrowserHelper requires a valid DirectoryHandle.");
    }
  }

  async getFileHandle(filename: string): Promise<FileSystemFileHandle> {
    if (fileHandleCache.has(filename)) {
      return fileHandleCache.get(filename)!;
    }
    // We only care about the basename as the directory is already handled.
    const name = filename.split("/").pop()!;
    const handle = await this.directoryHandle.getFileHandle(name, {create: true});
    fileHandleCache.set(filename, handle);
    return handle;
  }
}

/**
 * The main test harness class that runs in the browser.
 */
class BrowserTestHarness {
  public duplex: BrowserFsDuplex<any, "handler"> | null = null;
  private directoryHandle: FileSystemDirectoryHandle | null = null;

  constructor() {
    console.log("[Browser Harness] Initialized.");
  }

  /**
   * Prompts the user for a directory and stores the handle.
   * This MUST be called from a user gesture in a real app,
   * but Playwright will pre-authorize it for us in the test.
   */
  public async getDirectoryHandle() {
    console.log("[Browser Harness] Requesting directory handle...");
    this.directoryHandle = await window.showDirectoryPicker({mode: "readwrite"});
    console.log("[Browser Harness] Directory handle obtained.");
    return true; // Signal success to Playwright
  }

  public async setup(filenamePrefix: string) {
    if (!this.directoryHandle) {
      throw new Error("Directory handle not available. Call getDirectoryHandle() first.");
    }
    console.log(`[Browser Harness] Setting up BrowserFsDuplex with prefix: ${filenamePrefix}`);
    if (this.duplex) {
      await this.duplex.stop();
    }
    const helper = new BrowserHelper(this.directoryHandle);
    this.duplex = new BrowserFsDuplex("handler", superjson, filenamePrefix, helper);

    this.duplex.onOpen.on(() => this.logEvent("open"));
    this.duplex.onClose.on((reason) => this.logEvent("close", reason));
    this.duplex.onData.on((payload) => this.logEvent("data", payload));
    this.duplex.onError.on((error) => this.logEvent("error", {message: error.message}));

    await this.duplex.start();
    console.log("[Browser Harness] BrowserFsDuplex started.");
  }

  public logEvent(event: string, payload?: any) {
    console.log(`__HARNESS_EVENT__:${JSON.stringify({event, payload})}`);
  }
}

// Expose the harness instance to the global scope
window.harness = new BrowserTestHarness();
