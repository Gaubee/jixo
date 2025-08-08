import {z} from "zod/v4-mini";
import type {FsDuplex} from "../fs-duplex/common.js";
import type {NodeFsDuplex} from "../fs-duplex/node.js";
import type {TaskRunner} from "../node/utils.js";
import {waitNextTask} from "./utils.js";

// 1. Zod 定义 (The Contract) - Cleaned up for the new protocol
export const zFetchTask = z.object({
  type: z.literal("fetch"),
  taskId: z.string(),
  // Fields sent from Node to Browser
  url: z.string(),
  init: z.any().optional(),
  sub_command: z.optional(z.enum(["getFullBody", "requestChunk"])),
  format: z.optional(z.enum(["json", "text"])), // For getFullBody command

  // Fields sent from Browser to Node
  status: z.enum([
    "initial", // Not used in active comms
    "pending", // Not used in active comms
    "responded", // Headers and status are ready
    "fulfilled", // Full body response is ready
    "rejected", // An error occurred
    "chunk", // A single data chunk for streaming
    "chunk_end", // Streaming is complete
    "chunk_error", // An error occurred during streaming
  ]),
  response: z.any().optional(), // Holds headers, status, etc.
  result: z.any().optional(), // Holds final full body
  payload: z.any().optional(), // Holds chunk data
  error: z.any().optional(), // Holds error info
  done: z.boolean(),
});
export type FetchTask = z.output<typeof zFetchTask>;

// 2. Browser 状态处理函数 (The Browser-side Logic - Active Service Loop)
export async function doFetch(duplex: FsDuplex<FetchTask, "handler">, initialTask: FetchTask): Promise<void> {
  let bodyReader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  try {
    const response = await fetch(initialTask.url, initialTask.init);
    bodyReader = response.body?.getReader();

    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => (responseHeaders[key] = value));

    // 1. Send initial response with headers
    duplex.sendData({
      ...initialTask,
      status: "responded",
      response: {
        headers: responseHeaders,
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
      },
      done: false,
    });

    // 2. Enter the service loop, waiting for commands from Node.js
    while (duplex.currentState === "open") {
      const commandTask = await waitNextTask(duplex, {timeout: 60000}); // 60s timeout for next command

      switch (commandTask.sub_command) {
        case "getFullBody":
          const body = commandTask.format === "json" ? await response.json() : await response.text();
          duplex.sendData({...initialTask, status: "fulfilled", result: body, done: true});
          return; // Task complete

        case "requestChunk":
          if (!bodyReader) {
            duplex.sendData({...initialTask, status: "chunk_error", error: "Response body is not readable.", done: true});
            return;
          }
          const {done, value} = await bodyReader.read();
          if (done) {
            duplex.sendData({...initialTask, status: "chunk_end", done: true});
            return; // Stream finished
          }
          // Send just the chunk payload
          duplex.sendData({...initialTask, status: "chunk", payload: value, done: false});
          break; // Continue loop, wait for next requestChunk
      }
    }
  } catch (e: any) {
    duplex.sendData({
      ...initialTask,
      status: "rejected",
      error: e instanceof Error ? {message: e.message, stack: e.stack} : e,
      done: true,
    });
  } finally {
    // Ensure resources are released if the duplex closes or an error occurs
    if (bodyReader) bodyReader.cancel().catch(() => {});
    duplex.close("done");
  }
}

// 3. Node 状态处理函数 (The Node-side Client)
class BrowserResponse {
  public readonly headers: Headers;
  public readonly ok: boolean;
  public readonly status: number;
  public readonly statusText: string;

  #duplex: NodeFsDuplex<FetchTask, "initiator">;
  #bodyUsed = false;
  #initialTask: FetchTask;

  constructor(duplex: NodeFsDuplex<FetchTask, "initiator">, initialTask: FetchTask) {
    this.#duplex = duplex;
    this.#initialTask = initialTask;
    this.headers = new Headers(initialTask.response.headers);
    this.ok = initialTask.response.ok;
    this.status = initialTask.response.status;
    this.statusText = initialTask.response.statusText;
  }

  async #readFullBody(format: "json" | "text"): Promise<any> {
    if (this.#bodyUsed) throw new TypeError(`Body has already been used.`);
    this.#bodyUsed = true;
    try {
      this.#duplex.sendData({...this.#initialTask, sub_command: "getFullBody", format});
      const finalTask = await waitNextTask(this.#duplex, {filter: (t) => t.done, timeout: 60000});
      if (finalTask.status === "rejected") throw finalTask.error;
      return finalTask.result;
    } finally {
      this.#duplex.close();
    }
  }

  get body(): ReadableStream<Uint8Array> | null {
    if (this.#bodyUsed) throw new TypeError("Body already used");
    this.#bodyUsed = true;
    if (!this.ok) return null;

    const duplex = this.#duplex;
    const initialTask = this.#initialTask;

    return new ReadableStream({
      async pull(controller) {
        try {
          duplex.sendData({...initialTask, sub_command: "requestChunk"});
          const nextMessage = await waitNextTask(duplex, {timeout: 60000});

          if (nextMessage.status === "chunk") {
            controller.enqueue(nextMessage.payload);
          } else if (nextMessage.status === "chunk_end") {
            controller.close();
            duplex.close("done");
          } else {
            const error = nextMessage.error || new Error("Unknown streaming error");
            controller.error(error);
            duplex.close("error");
          }
        } catch (e) {
          controller.error(e);
          duplex.close("error");
        }
      },
      cancel() {
        duplex.close("done");
      },
    });
  }

  async json(): Promise<any> {
    return this.#readFullBody("json");
  }
  async text(): Promise<string> {
    return this.#readFullBody("text");
  }
  async arrayBuffer(): Promise<ArrayBuffer> {
    throw new Error("arrayBuffer() is not yet implemented in the new protocol. Use the streaming body instead.");
  }
}

export const createRunFetchInBrowser = (runner: TaskRunner) => {
  return async (dir: string, url: string, init?: RequestInit): Promise<BrowserResponse> => {
    const taskId = crypto.randomUUID();
    const initialTask: FetchTask = {
      type: "fetch",
      taskId,
      url,
      init,
      status: "initial",
      done: false,
    };

    const duplex = await runner<FetchTask>({dir, initialTask});

    try {
      // Wait for the initial "responded" message from the browser
      const respondedTask = await waitNextTask(duplex, {
        filter: (task) => task.status === "responded",
        timeout: 30000,
      });
      return new BrowserResponse(duplex, respondedTask);
    } catch (error) {
      // If we timeout or the connection closes before getting the response, destroy the channel.
      duplex.destroy();
      throw error;
    }
  };
};
