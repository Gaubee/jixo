import {z} from "zod/v4-mini";
import type {FsDuplex} from "../fs-duplex/common.js";
import type {NodeFsDuplex} from "../fs-duplex/node.js";
import type {TaskRunner} from "../node/utils.js";
import {waitNextTask} from "./utils.js";

// 1. Zod 定义 (The Contract) - Rebuilt with z.union for full type safety

// Base object with common fields
const zBaseFetchTask = z.object({
  type: z.literal("fetch"),
  taskId: z.string(),
});

// --- Node.js -> Browser Commands ---
const zFetchInitialCommand = z.extend(zBaseFetchTask, {
  status: z.literal("initial"),
  url: z.string(),
  init: z.optional(z.any()),
  done: z.literal(false),
});
const zFetchGetFullBodyCommand = z.extend(zBaseFetchTask, {
  sub_command: z.literal("getFullBody"),
  format: z.enum(["json", "text"]),
});
const zFetchRequestChunkCommand = z.extend(zBaseFetchTask, {
  sub_command: z.literal("requestChunk"),
});

// --- Browser -> Node.js Events ---
const zFetchRespondedEvent = z.extend(zBaseFetchTask, {
  status: z.literal("responded"),
  response: z.object({
    headers: z.record(z.string()),
    ok: z.boolean(),
    status: z.number(),
    statusText: z.string(),
  }),
  done: z.literal(false),
});
const zFetchFulfilledEvent = z.extend(zBaseFetchTask, {
  status: z.literal("fulfilled"),
  result: z.any(),
  done: z.literal(true),
});
const zFetchChunkEvent = z.extend(zBaseFetchTask, {
  status: z.literal("chunk"),
  payload: z.instanceof(Uint8Array),
  done: z.literal(false),
});
const zFetchChunkEndEvent = z.extend(zBaseFetchTask, {
  status: z.literal("chunk_end"),
  done: z.literal(true),
});
const zFetchErrorEvent = z.extend(zBaseFetchTask, {
  status: z.union([z.literal("rejected"), z.literal("chunk_error")]),
  error: z.any(),
  done: z.literal(true),
});

export const zFetchTask = z.union([
  zFetchInitialCommand,
  zFetchGetFullBodyCommand,
  zFetchRequestChunkCommand,
  zFetchRespondedEvent,
  zFetchFulfilledEvent,
  zFetchChunkEvent,
  zFetchChunkEndEvent,
  zFetchErrorEvent,
]);

export type FetchTask = z.output<typeof zFetchTask>;
type FetchInitialCommand = z.output<typeof zFetchInitialCommand>;

// 2. Browser 状态处理函数 (The Browser-side Logic - Active Service Loop)
export async function doFetch(duplex: FsDuplex<FetchTask, "handler">, initialTask: FetchInitialCommand): Promise<void> {
  let bodyReader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  try {
    const response = await fetch(initialTask.url, initialTask.init);
    bodyReader = response.body?.getReader();

    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => (responseHeaders[key] = value));

    // 1. Send initial response with headers
    duplex.sendData({
      type: "fetch",
      taskId: initialTask.taskId,
      status: "responded",
      response: {headers: responseHeaders, ok: response.ok, status: response.status, statusText: response.statusText},
      done: false,
    });

    // 2. Enter the service loop, waiting for commands from Node.js
    while (duplex.currentState === "open") {
      const commandTask = await waitNextTask(duplex, {timeout: 60000});

      if ("sub_command" in commandTask) {
        switch (commandTask.sub_command) {
          case "getFullBody":
            const body = commandTask.format === "json" ? await response.json() : await response.text();
            duplex.sendData({type: "fetch", taskId: initialTask.taskId, status: "fulfilled", result: body, done: true});
            return; // Task complete

          case "requestChunk":
            if (!bodyReader) {
              duplex.sendData({type: "fetch", taskId: initialTask.taskId, status: "chunk_error", error: "Response body is not readable.", done: true});
              return;
            }
            const {done, value} = await bodyReader.read();
            if (done) {
              duplex.sendData({type: "fetch", taskId: initialTask.taskId, status: "chunk_end", done: true});
              return; // Stream finished
            }
            duplex.sendData({type: "fetch", taskId: initialTask.taskId, status: "chunk", payload: value, done: false});
            break; // Continue loop, wait for next requestChunk
        }
      }
    }
  } catch (e: any) {
    duplex.sendData({
      type: "fetch",
      taskId: initialTask.taskId,
      status: "rejected",
      error: e instanceof Error ? {message: e.message, stack: e.stack} : e,
      done: true,
    });
  } finally {
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
  #taskId: string;

  constructor(duplex: NodeFsDuplex<FetchTask, "initiator">, initialResponse: Extract<FetchTask, {status: "responded"}>) {
    this.#duplex = duplex;
    this.#taskId = initialResponse.taskId;
    this.headers = new Headers(initialResponse.response.headers);
    this.ok = initialResponse.response.ok;
    this.status = initialResponse.response.status;
    this.statusText = initialResponse.response.statusText;
  }

  async #readFullBody(format: "json" | "text"): Promise<any> {
    if (this.#bodyUsed) throw new TypeError(`Body has already been used.`);
    this.#bodyUsed = true;
    try {
      this.#duplex.sendData({type: "fetch", taskId: this.#taskId, sub_command: "getFullBody", format});
      const finalTask = await waitNextTask(this.#duplex, {filter: (t) => "done" in t && t.done, timeout: 60000});

      if (finalTask.status === "rejected") throw finalTask.error;
      if (finalTask.status === "fulfilled") return finalTask.result;
      throw new Error("Unexpected final task status: " + (finalTask as any).status);
    } finally {
      this.#duplex.close();
    }
  }

  get body(): ReadableStream<Uint8Array> | null {
    if (this.#bodyUsed) throw new TypeError("Body already used");
    this.#bodyUsed = true;
    if (!this.ok) return null;

    const duplex = this.#duplex;
    const taskId = this.#taskId;

    return new ReadableStream({
      async pull(controller) {
        try {
          duplex.sendData({type: "fetch", taskId, sub_command: "requestChunk"});
          const nextMessage = await waitNextTask(duplex, {timeout: 60000});

          if (nextMessage.status === "chunk") {
            controller.enqueue(nextMessage.payload);
          } else if (nextMessage.status === "chunk_end") {
            controller.close();
            duplex.close("done");
          } else if (nextMessage.status === "chunk_error" || nextMessage.status === "rejected") {
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
    const initialTask: FetchInitialCommand = {
      type: "fetch",
      taskId,
      url,
      init,
      status: "initial",
      done: false,
    };

    const duplex = await runner<FetchTask>({dir, initialTask: initialTask as any});

    try {
      const respondedTask = await waitNextTask(duplex, {
        filter: (task): task is Extract<FetchTask, {status: "responded"}> => task.status === "responded",
        timeout: 30000,
      });
      return new BrowserResponse(duplex, respondedTask);
    } catch (error) {
      duplex.destroy();
      throw error;
    }
  };
};
