import {func_remember} from "@gaubee/util";
import type {z} from "zod/v4-mini";
import {delay, getEasyFs} from "../../google-aistudio/browser/utils.js";
import {zModels} from "../common/types.js";
import {getWindowId} from "./utils.js";

interface CapturedData {
  headers: Record<string, string>;
  models: z.infer<typeof zModels>["data"];
}

let capturedDataPromise: Promise<CapturedData>;

/**
 * Captures critical headers by instrumenting `fetch` and simulating a UI interaction.
 * @returns A promise that resolves with the captured headers and model list.
 */
async function captureAndHold(): Promise<CapturedData> {
  if (capturedDataPromise) {
    return capturedDataPromise;
  }

  capturedDataPromise = new Promise(async (resolve, reject) => {
    const originalFetch = window.fetch;
    const headers: Record<string, string> = {};
    let resolved = false;

    // Monkey-patch fetch
    window.fetch = function (...args) {
      const request = new Request(...args);
      // We are interested in the chat completions request to get headers
      const auth = request.headers.get("Authorization");
      const org = request.headers.get("groq-organization");
      if (auth && org) {
        Object.assign(headers, {
          Authorization: auth,
          "groq-organization": org,
        });
        resolved = true;
        // // Once captured, we can restore the original fetch
        // window.fetch = originalFetch;
      }
      return originalFetch.call(this, request);
    };

    // Wait for the button to appear and click it
    const triggerFetch = async () => {
      while (!resolved) {
        // trigger the fetch
        document.dispatchEvent(new Event("visibilitychange"));
        await delay(500);
      }
    };

    console.log(`初始化中，通常5秒内能完成...`);
    await triggerFetch();

    // Wait until headers are captured
    while (!resolved) {
      await delay(100);
    }

    // Now use the captured headers to get the models
    try {
      const modelsResponse = await originalFetch("https://api.groq.com/internal/v1/models", {headers});
      const modelsJson = await modelsResponse.json();
      const models = zModels.parse(modelsJson).data;
      resolve({headers, models});
    } catch (error) {
      reject(error);
    }
  });

  return capturedDataPromise;
}

/**
 * Initializes session management, captures auth, and starts the heartbeat.
 */
export const initializeSession = func_remember(async () => {
  try {
    const {headers, models} = await captureAndHold();
    const fs = await getEasyFs();
    const windowId = getWindowId();
    if (!windowId) {
      console.error("Session heartbeat failed: windowId not found.");
      return;
    }

    // Start the heartbeat interval
    setInterval(() => {
      const session = {time: Date.now(), headers, models};
      fs.writeFile(`${windowId}.groq-session.json`, JSON.stringify(session));
    }, 1000);

    console.log("Session initialized and heartbeat started.");
  } catch (error) {
    initializeSession.reset();
    console.error("Failed to initialize session:", error);
  }
});
