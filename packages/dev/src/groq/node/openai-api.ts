import {blue, gray} from "@gaubee/nodekit";
import {serve} from "@hono/node-server";
import {Hono} from "hono";
import {cors} from "hono/cors";
import {logger} from "hono/logger";
import {streamSSE} from "hono/streaming";
import type {StatusCode} from "hono/utils/http-status";
import type {AddressInfo} from "node:net";
import {findActiveGroqSession} from "./session.js";
import {evaler} from "./utils.js";

export interface StartServeOptions {
  dir: string;
  port: number;
}
export const startServe = async ({dir, port}: StartServeOptions) => {
  const job = Promise.withResolvers<AddressInfo>();
  // Establish session once on startup. The session object will be updated
  // in the background by the logic within `findActiveGroqSession`.
  const session = await findActiveGroqSession(dir);

  // --- Hono Application ---
  const app = new Hono();
  app.use(cors());
  app.use(logger());

  app.get("/", (c) => c.text("Groq OpenAI-Compatible API Proxy is running!"));

  // Special handler for the /v1/models endpoint
  app.get("/v1/models", (c) => {
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
        "Content-Type": c.req.header("Content-Type") || session.headers["Content-Type"],
      },
      body: c.req.method !== "GET" && c.req.method !== "HEAD" ? await c.req.arrayBuffer() : undefined,
    };

    try {
      const browserResponse = await evaler.runFetchInBrowser(dir, groqApiUrl, requestInit);

      browserResponse.headers.forEach((value, key) => c.header(key, value));
      c.status(browserResponse.status as StatusCode);

      if (!browserResponse.ok) {
        const errorBody = await browserResponse.text().catch(() => browserResponse.statusText);
        try {
          return c.json(JSON.parse(errorBody));
        } catch {
          return c.text(errorBody);
        }
      }

      if (isStreaming && browserResponse.body) {
        return streamSSE(c, async (stream) => {
          await stream.pipe(browserResponse.body!);
        });
      } else {
        return c.json(await browserResponse.json());
      }
    } catch (error: any) {
      console.error("Proxy error:", error);
      return c.json({error: {message: error.message || "Proxy error"}}, 500);
    }
  });

  // --- Server Startup ---
  serve({fetch: app.fetch, port}, (info) => {
    job.resolve(info);
    console.log(gray(`OpenAI-compatible proxy server started.`));
    console.log(gray("listening on"), blue(`http://localhost:${info.port}`));
    console.log(gray("Press Ctrl+C to stop."));
  });
  return job;
};
