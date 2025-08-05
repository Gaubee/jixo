import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";
import type {Browser, BrowserContext, ConsoleMessage, Page} from "playwright";
import {chromium} from "playwright";
import {createServer, type ViteDevServer} from "vite";
import {afterAll, afterEach, beforeAll, beforeEach, describe, expect, it} from "vitest";
import {NodeFsDuplex} from "./node.js";
import {superjson} from "./superjson.js";

// --- Playwright & Test Setup ---
let browser: Browser;
let context: BrowserContext;
let page: Page;
let testDir: string;
let taskFilepathPrefix: string;
let viteServer: ViteDevServer;

// --- Test-specific variables ---
let initiator: NodeFsDuplex<any, "initiator">;

/**
 * A helper function to wait for a specific event logged by the browser harness.
 */
function waitForHarnessEvent<T = any>(eventName: string, timeout = 5000): Promise<T> {
  // ... (implementation remains the same)
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
    // 1. Create and start a Vite server
    viteServer = await createServer({
      root: path.dirname(fileURLToPath(import.meta.url)),
      server: {port: 0},
      logLevel: "silent",
    });
    await viteServer.listen();
    const serverPort = viteServer.config.server.port!;

    // 2. Launch Browser with permissions
    browser = await chromium.launch({headless: true});
    context = await browser.newContext({
      permissions: ["storage-access"],
    });
    page = await context.newPage();

    // 3. Navigate to the harness page
    const targetUrl = `http://localhost:${serverPort}/E2E-browser-harness.html`;
    await page.goto(targetUrl);
    await page.waitForFunction(() => window.harness);
  }, 30000);

  afterAll(async () => {
    await browser?.close();
    await viteServer?.close();
  });

  beforeEach(async () => {
    // 1. Create a unique temporary directory for the test
    testDir = path.join(os.tmpdir(), `fs-duplex-e2e-test-${crypto.randomUUID()}`);
    await fsp.mkdir(testDir, {recursive: true});
    taskFilepathPrefix = path.join(testDir, "task");

    // 2. Trigger the (pre-approved) directory picker in the browser
    // This connects the browser's harness to our temporary directory.
    await page.evaluate(() => window.harness.getDirectoryHandle());
    await page.evaluate((prefix) => window.harness.setup(prefix), taskFilepathPrefix);

    // 3. Create the Node.js initiator instance pointing to the same directory
    initiator = new NodeFsDuplex("initiator", superjson, taskFilepathPrefix);
  });

  afterEach(async () => {
    await initiator?.stop();
    if (testDir) {
      await fsp.rm(testDir, {recursive: true, force: true}).catch(() => {});
    }
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
