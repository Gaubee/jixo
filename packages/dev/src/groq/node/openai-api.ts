import {gray, green, red} from "@gaubee/nodekit";
import {delay, func_remember} from "@gaubee/util";
import {serve} from "@hono/node-server";
import {globby} from "globby";
import {Hono} from "hono";
import {cors} from "hono/cors";
import {logger} from "hono/logger";
import {streamSSE} from "hono/streaming";
import type {ContentfulStatusCode, StatusCode} from "hono/utils/http-status";
import fsp from "node:fs/promises";
import type {AddressInfo} from "node:net";
import {zSession} from "../common/types.js";
import {evaler} from "./utils.js";

// --- Session Management ---
const findActiveGroqSession = func_remember(async (dir: string) => {
  const readSessionFile = async (sessionFile: string) => {
    try {
      const content = await fsp.readFile(sessionFile, "utf-8");
      const data = JSON.parse(content);
      const session = zSession.safeParse(data);
      return session.data;
    } catch {}
  };
  while (true) {
    const sessionFiles = await globby("*.groq-session.json", {cwd: dir, absolute: true});
    console.log(gray("等待 groq 会话建立"), sessionFiles);
    for (const sessionFile of sessionFiles) {
      try {
        const session = await readSessionFile(sessionFile);
        if (!session) {
          continue;
        }
        const unlinkTasksFiles = async () => {
          const windowId = sessionFile.replace(".groq-session.json", "");
          const taskFiles = await globby(`${windowId}.*.groq-task.json`);
          for (const taskfile of taskFiles) {
            await fsp.unlink(taskfile);
          }
        };
        if (Date.now() - session.time <= 5000) {
          console.log(green("groq 会话建立完成"));

          let preTime = session.time;
          let status: "disconnected" | "connected" = "connected";
          void (async () => {
            while (true) {
              await delay(1000);
              const newSession = await readSessionFile(sessionFile);
              if (!newSession) {
                continue;
              }
              Object.assign(session, newSession);
              preTime = session.time;
              if (Date.now() - preTime > 5000) {
                if (status !== "disconnected") {
                  status = "disconnected";
                  console.error(red("groq 会话断开，请激活窗口，确保重连"));
                }
              } else {
                if (status !== "connected") {
                  status = "connected";
                  console.error(green("groq 会话恢复建立"));
                }
              }
            }
          })();
          /// 清理task文件
          await unlinkTasksFiles();
          // 5 second timeout
          return session;
        } else {
          await fsp.unlink(sessionFile);
          await unlinkTasksFiles();
        }
      } catch {
        continue;
      }
    }
    await delay(1000);
  }
});

export interface StartServeOptions {
  dir: string;
  port: number;
}
export const startServe = async ({dir, port}: StartServeOptions) => {
  const job = Promise.withResolvers<AddressInfo>();
  const session = await findActiveGroqSession(dir);
  if (!session) {
    throw new Error("No active browser session found.");
  }

  // --- Hono Application ---
  const app = new Hono();
  app.use(cors());
  app.use(logger());

  app.get("/", (c) => c.text("Groq OpenAI-Compatible API Proxy is running!"));

  // Special handler for the /v1/models endpoint
  app.get("/v1/models", async (c) => {
    // Format the models data to be compatible with OpenAI's /v1/models response
    const openaiFormattedModels = {
      object: "list",
      data: session.models,
    };
    return c.json(openaiFormattedModels);
  });

  // Generic proxy for all other /v1/* routes
  app.all("/v1/*", async (c) => {
    const path = new URL(c.req.url).pathname;
    const groqApiUrl = `https://api.groq.com/openai${path}`;

    const isStreaming = c.req.method === "POST" && (await c.req.json().catch(() => ({}))).stream === true;

    const requestInit: RequestInit = {
      method: c.req.method,
      headers: {
        ...session.headers,
        // Allow client to override content-type if needed
        "Content-Type": c.req.header("Content-Type") || session.headers["Content-Type"],
      },
      // Only add body for methods that support it
      body: c.req.method !== "GET" && c.req.method !== "HEAD" ? await c.req.arrayBuffer() : undefined,
    };

    try {
      const browserResponse = await evaler.runFetchInBrowser(dir, groqApiUrl, requestInit);

      c.header("Content-Type", browserResponse.headers.get("Content-Type") || "application/json");
      c.status(browserResponse.status as StatusCode);

      if (!browserResponse.ok) {
        return c.json(await browserResponse.json(), browserResponse.status as ContentfulStatusCode, Object.fromEntries(browserResponse.headers.entries()));
      }

      if (isStreaming && browserResponse.body) {
        return streamSSE(c, async (stream) => {
          const reader = browserResponse.body!.getReader();
          while (true) {
            const {done, value} = await reader.read();
            console.log("QAQ streamSSE", value);
            if (done) break;
            await stream.write(value);
          }
        });
      } else {
        return c.json(await browserResponse.json(), browserResponse.status as ContentfulStatusCode, Object.fromEntries(browserResponse.headers.entries()));
      }
    } catch (error: any) {
      return c.json({error: {message: error.message || "Proxy error"}}, 500);
    }
  });

  // --- Server Startup ---
  serve(
    {
      fetch: app.fetch,
      port: port,
    },
    (info) => {
      job.resolve(info);
      console.log(`OpenAI-compatible proxy server is listening on http://localhost:${info.port}`);
      console.log("Press Ctrl+C to stop.");
    },
  );
  return job;
};
