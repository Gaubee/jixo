import {blue, gray} from "@gaubee/nodekit";
import {serve} from "@hono/node-server";
import {Hono} from "hono";
import {cors} from "hono/cors";
import {logger} from "hono/logger";
import {streamSSE} from "hono/streaming";
import type {ContentfulStatusCode, StatusCode} from "hono/utils/http-status";
import type {AddressInfo} from "node:net";
import {findActiveGroqSession} from "./session.js";
import {evaler} from "./utils.js";

export interface StartServeOptions {
  dir: string;
  port: number;
}
export const startServe = async ({dir, port}: StartServeOptions) => {
  const job = Promise.withResolvers<AddressInfo>();
  /// 等待回话建立
  await findActiveGroqSession(dir);

  // --- Hono Application ---
  const app = new Hono();
  app.use(cors());
  app.use(logger());

  app.get("/", (c) => c.text("Groq OpenAI-Compatible API Proxy is running!"));

  // Special handler for the /v1/models endpoint
  app.get("/v1/models", async (c) => {
    const session = await findActiveGroqSession(dir);
    // Format the models data to be compatible with OpenAI's /v1/models response
    const openaiFormattedModels = {
      object: "list",
      data: session.models,
    };
    return c.json(openaiFormattedModels);
  });

  // Generic proxy for all other /v1/* routes
  app.all("/v1/*", async (c) => {
    const session = await findActiveGroqSession(dir);
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
      console.log(gray(`OpenAI-compatible proxy server started.`));
      console.log(gray("listening on"), blue(`http://localhost:${info.port}`));
      console.log(gray("Press Ctrl+C to stop."));
    },
  );
  return job;
};
