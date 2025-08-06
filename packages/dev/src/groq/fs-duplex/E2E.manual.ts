import {delay} from "@gaubee/util";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import {fileURLToPath} from "node:url";
import {chromium, type Browser, type ConsoleMessage, type Page} from "playwright";
import {createServer, type ViteDevServer} from "vite";
import {NodeFsDuplex} from "./node.js";
import {superjson} from "./superjson.js";

function askQuestion(query: string): Promise<string> {
  const rl = readline.createInterface({input: process.stdin, output: process.stdout});
  return new Promise((resolve) =>
    rl.question(query, (ans) => {
      rl.close();
      resolve(ans);
    }),
  );
}

function waitForHarnessEvent<T = any>(page: Page, eventName: string, timeout = 10000): Promise<T> {
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
            page.off("console", listener); // Important: remove listener once event is caught
            clearTimeout(timeoutId);
            resolve(eventData.payload);
          }
        } catch (e) {}
      }
    };
    page.on("console", listener);
  });
}

async function main() {
  console.log("--- FsDuplex E2E Manual Verification ---");
  const sharedDir = path.join(os.tmpdir(), `fs-duplex-manual-e2e-${crypto.randomUUID()}`);
  await fsp.mkdir(sharedDir, {recursive: true});

  console.log("\n!!! ACTION REQUIRED (ONCE) !!!");
  console.log("------------------------------------------------------------------");
  console.log("A browser window will open. When prompted, click the 'Initialize Connection' button");
  console.log("and select the following directory:");
  console.log(`   \x1b[32m${sharedDir}\x1b[0m`);
  console.log("You will need to re-initialize for each test step shown in the terminal.");
  console.log("------------------------------------------------------------------");
  await askQuestion("Press ENTER to start...");

  let viteServer: ViteDevServer | undefined;
  let browser: Browser | undefined;

  try {
    viteServer = await createServer({root: path.dirname(fileURLToPath(import.meta.url)), server: {port: 0}, logLevel: "silent"});
    await viteServer.listen();
    const origin = `http://localhost:${viteServer.config.server.port!}`;

    browser = await chromium.launch({headless: false});
    const page = await browser.newPage();
    page.on("console", (msg) => {
      if (!msg.text().startsWith("__HARNESS_EVENT__")) {
        console.log(`[Browser Console] ${msg.text()}`);
      }
    });
    await page.goto(`${origin}/E2E-browser-harness.html`);
    await page.waitForFunction(() => window.harness);

    // --- Step 1: Handshake ---
    const taskPrefix1 = path.join(sharedDir, `task-${crypto.randomUUID()}`);
    await page.evaluate((prefix) => {
      document.getElementById("action-button")!.onclick = () => window.harness.initialize(prefix);
    }, path.basename(taskPrefix1));
    console.log("\n[Action] Please click 'Initialize Connection' in the browser to start the Handshake test.");
    await waitForHarnessEvent(page, "initialized");

    console.log("--- Running Test: Handshake ---");
    const initiator1 = new NodeFsDuplex("initiator", superjson, taskPrefix1);
    const browserOpenPromise = waitForHarnessEvent(page, "open");
    const initiatorOpenPromise = initiator1.onOpen.once();
    await initiator1.start();
    initiator1.init({message: "Hello!"});
    await Promise.all([initiatorOpenPromise, browserOpenPromise]);
    console.log("✅ SUCCESS: Handshake");

    // --- Step 2: Bidirectional Data ---
    console.log("\n--- Running Test: Bidirectional Data ---");
    const dataFromBrowser = initiator1.onData.once();
    await page.evaluate(() => window.harness.duplex!.sendData({from: "browser"}));
    if (((await dataFromBrowser) as any).from !== "browser") throw new Error("Data from browser failed");

    const dataFromNode = waitForHarnessEvent(page, "data");
    initiator1.sendData({from: "node"});
    if (((await dataFromNode) as any).from !== "node") throw new Error("Data from node failed");
    console.log("✅ SUCCESS: Bidirectional Data");

    // --- Step 3: Graceful Close ---
    console.log("\n--- Running Test: Graceful Close ---");
    const browserClose = waitForHarnessEvent(page, "close");
    const initiatorClose = initiator1.onClose.once();
    initiator1.close();
    const [browserReason, initiatorReason] = await Promise.all([browserClose, initiatorClose]);
    if (browserReason !== "graceful" || initiatorReason !== "graceful") {
      throw new Error(`Close reason mismatch: Node=${initiatorReason}, Browser=${browserReason}`);
    }
    console.log("✅ SUCCESS: Graceful Close");

    console.log("\n\n🎉 All manual verification steps completed successfully! You can close the browser.");
    await askQuestion("Press ENTER to cleanup and exit...");
  } catch (error: any) {
    console.error("\n--- ❌ A verification step failed ---");
    console.error(error);
  } finally {
    console.log("\n[Verification] Cleaning up resources...");
    await browser?.close();
    await viteServer?.close();
    await fsp.rm(sharedDir, {recursive: true, force: true});
    console.log("[Verification] Cleanup complete.");
    await delay(50);
    process.exit(0);
  }
}

main();
