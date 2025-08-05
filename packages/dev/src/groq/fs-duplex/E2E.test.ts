import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";
import type {Browser, ConsoleMessage, Page} from "playwright";
import {chromium} from "playwright";
import {createServer, type ViteDevServer} from "vite";
import {afterAll, afterEach, beforeAll, beforeEach, describe, expect, it} from "vitest";
import {NodeFsDuplex} from "./node.js";
import {superjson} from "./superjson.js";

// --- Playwright & Test Setup ---
let browser: Browser;
let page: Page;
let testDir: string; // This is now the shared directory
let taskFilepathPrefix: string;
let viteServer: ViteDevServer;

// --- Test-specific variables ---
let initiator: NodeFsDuplex<any, "initiator">;

/**
 * A helper function to wait for a specific event logged by the browser harness.
 */
function waitForHarnessEvent<T = any>(eventName: string, timeout = 1000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      page.off("console", listener);
      reject(new Error(`Timed out waiting for harness event "${eventName}"`));
    }, timeout);
    const listener = (msg: ConsoleMessage) => {
      const text = msg.text();
      if (text.startsWith("__HARNESS_EVENT__:")) {
        try {
          const eventData = JSON.parse(text.substring("__HARNESS_EVENT__:".length));
          if (eventData.event === eventName) {
            clearTimeout(timeoutId);
            page.off("console", listener);
            resolve(eventData.payload);
          }
        } catch (e) {}
      }
    };
    page.on("console", listener);
  });
}

describe("FsDuplex E2E Test (Node.js <-> Browser)", () => {
  beforeAll(async () => {
    // 1. Create the shared directory that both Node and the browser will use.
    testDir = path.join(os.tmpdir(), `fs-duplex-shared-${crypto.randomUUID()}`);
    await fsp.mkdir(testDir, {recursive: true});

    // 2. Create and start a Vite server
    viteServer = await createServer({
      root: path.dirname(fileURLToPath(import.meta.url)),
      server: {port: 0},
      logLevel: "silent",
    });
    await viteServer.listen();
    const serverPort = viteServer.config.server.port!;
    const origin = `http://localhost:${serverPort}`;

    // 3. Launch Browser with the critical OPFS mapping argument
    browser = await chromium.launch({
      headless: true,
      args: [`--origin-to-opaque-file-system=${origin}=${testDir}`],
    });
    page = await browser.newPage();

    // *** CRITICAL: Ensure all browser logs are forwarded for debugging ***
    page.on("console", (msg) => {
      console.log(`[Browser Console] ${msg.text()}`);
    });

    // 4. Navigate to the harness page
    await page.goto(`${origin}/E2E-browser-harness.html`);
    await page.waitForFunction(() => window.harness);
  }, 30000);

  afterAll(async () => {
    await browser?.close();
    await viteServer?.close();
    // Clean up the shared directory
    if (testDir) {
      await fsp.rm(testDir, {recursive: true, force: true}).catch(() => {});
    }
  });

  beforeEach(async () => {
    // The shared directory is already created, we just need the prefix
    taskFilepathPrefix = path.join(testDir, `task-${crypto.randomUUID()}`);

    // Reset the browser harness
    await page.evaluate((prefix) => window.harness.setup(prefix), taskFilepathPrefix);

    // Create the Node.js initiator instance pointing to the same directory
    initiator = new NodeFsDuplex("initiator", superjson, taskFilepathPrefix);
  });

  afterEach(async () => {
    await initiator?.stop();
    // No need to delete testDir here, it's handled in afterAll
  });

  it("should complete a full handshake between Node.js and Browser", async () => {
    // Arrange
    const initiatorOpenPromise = initiator.onOpen.once();
    const browserOpenPromise = waitForHarnessEvent("open");

    // Act
    await initiator.start();
    initiator.init({message: "Hello from Node!"});

    // Assert
    await Promise.all([initiatorOpenPromise, browserOpenPromise]);

    expect(initiator.currentState).toBe("open");
    const browserState = await page.evaluate(() => window.harness.duplex!.currentState);
    expect(browserState).toBe("open");
  });
});
