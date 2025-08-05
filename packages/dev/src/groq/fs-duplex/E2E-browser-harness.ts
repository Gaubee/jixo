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
 * Implements the FsDuplexBrowserHelper interface required by BrowserFsDuplex.
 * This implementation now correctly uses the Origin Private File System (OPFS),
 * which will be mapped to a real directory by Playwright's launch arguments.
 */
class BrowserHelper implements FsDuplexBrowserHelper {
  private root: FileSystemDirectoryHandle | null = null;

  private async getRoot() {
    if (!this.root) {
      console.log("[Browser Helper] Getting navigator.storage.getDirectory()...");
      this.root = await navigator.storage.getDirectory();
      console.log("[Browser Helper] Root directory handle obtained.");
    }
    return this.root;
  }

  async getFileHandle(filename: string): Promise<FileSystemFileHandle> {
    const name = filename.split("/").pop()!;
    console.log(`[Browser Helper] getFileHandle called for filename: "${filename}", using basename: "${name}"`);
    if (fileHandleCache.has(name)) {
      console.log(`[Browser Helper] Cache hit for "${name}".`);
      return fileHandleCache.get(name)!;
    }
    console.log(`[Browser Helper] Cache miss for "${name}", getting handle from root.`);
    const root = await this.getRoot();
    const handle = await root.getFileHandle(name, {create: true});
    fileHandleCache.set(name, handle);
    console.log(`[Browser Helper] Got and cached handle for "${name}".`);
    return handle;
  }
}

/**
 * The main test harness class that runs in the browser.
 */
class BrowserTestHarness {
  public duplex: BrowserFsDuplex<any, "handler"> | null = null;
  private helper: BrowserHelper | null = null;

  constructor() {
    console.log("[Browser Harness] Initialized.");
  }

  public async setup(filenamePrefix: string) {
    console.log(`[Browser Harness] Setting up BrowserFsDuplex with prefix: ${filenamePrefix}`);
    if (this.duplex) {
      await this.duplex.stop();
    }
    // The helper is now stateless and can be created on the fly.
    this.helper = new BrowserHelper();
    this.duplex = new BrowserFsDuplex("handler", superjson, filenamePrefix, this.helper);

    this.duplex.onOpen.on(() => this.logEvent("open"));
    this.duplex.onClose.on((reason) => this.logEvent("close", reason));
    this.duplex.onData.on((payload) => this.logEvent("data", payload));
    this.duplex.onError.on((error) => this.logEvent("error", {message: error.message}));

    await this.duplex.start();
    console.log("[Browser Harness] BrowserFsDuplex started.");
  }

  public logEvent(event: string, payload?: any) {
    // This specific format is what the Node.js test runner waits for.
    console.log(`__HARNESS_EVENT__:${JSON.stringify({event, payload})}`);
  }
}

// Expose the harness instance to the global scope
window.harness = new BrowserTestHarness();
