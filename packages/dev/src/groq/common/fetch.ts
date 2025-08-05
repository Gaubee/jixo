import {z} from "zod/v4-mini";
import type {FsDuplex} from "../common/fs-duplex.js";
import type {TaskRunner} from "../node/utils.js";

// 1. Zod 定义 (The Contract is already updated)
export const zFetchTask = z.object({
  type: z.literal("fetch"),
  taskId: z.string(),
  url: z.string(),
  init: z.any(), // Corresponds to RequestInit
  responseType: z.optional(z.enum(["json", "text", "arrayBuffer", "stream"])),
  status: z.enum(["initial", "pending", "responded", "streaming", "updating", "fulfilled", "rejected"]),
  response: z.any(),
  result: z.any(),
  chunks: z.array(z.instanceof(Uint8Array)),
  done: z.boolean(),
});
export type FetchTask = z.output<typeof zFetchTask>;

// 2. Browser 状态处理函数
export async function* doFetch(input: FetchTask): AsyncGenerator<{changed: boolean; output: FetchTask}> {
  let output = {...input};
  try {
    const response = await fetch(output.url, output.init);
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => (responseHeaders[key] = value));
    output.status = "responded";
    output.response = {
      headers: responseHeaders,
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
    };
    yield {changed: true, output};

    // Wait for the Node.js side to tell us what kind of body to process.
    // The `handleTask` in `sync.ts` will feed the updated task back to us.
    while (output.responseType === undefined) {
      yield {changed: false, output};
      if (output.done) return; // Node side could have cancelled
    }

    if (!response.ok) {
      // Even if not ok, we might need to read the body for error details.
      // But we will mark the task as rejected later.
    }

    switch (output.responseType) {
      case "json":
        output.result = await response.json();
        break;
      case "text":
        output.result = await response.text();
        break;
      case "arrayBuffer":
        output.result = await response.arrayBuffer();
        break;
      case "stream":
        const reader = response.body?.getReader();
        if (!reader) throw new Error("Response body is not readable.");

        // IMPORTANT: Signal that streaming has started
        output.status = "streaming";
        yield {changed: true, output};

        while (true) {
          const {done, value} = await reader.read();
          if (done) break;
          output.chunks.push(new Uint8Array(value));
          yield {changed: true, output};
        }
        break;
    }

    output.status = response.ok ? "fulfilled" : "rejected";
    if (output.status === "rejected" && !output.result) {
      // If result is not already populated by json/text, use a generic error
      output.result = `Request failed with status ${response.status}`;
    }
  } catch (e) {
    output.status = "rejected";
    output.result = e instanceof Error ? {message: e.message, stack: e.stack} : e;
  } finally {
    output.done = true;
  }
  yield {changed: true, output};
}

// 3. Node 状态处理函数
class BrowserResponse {
  public readonly headers: Headers;
  public readonly ok: boolean;
  public readonly status: number;
  public readonly statusText: string;

  #duplex: FsDuplex<FetchTask>;
  #bodyUsed = false;

  constructor(duplex: FsDuplex<FetchTask>) {
    this.#duplex = duplex;
    const initialTask = duplex.data()!;
    this.headers = new Headers(initialTask.response.headers);
    this.ok = initialTask.response.ok;
    this.status = initialTask.response.status;
    this.statusText = initialTask.response.statusText;
  }

  async #readBody(responseType: FetchTask["responseType"]): Promise<any> {
    if (this.#bodyUsed) {
      throw new TypeError(`Body has already been used.`);
    }
    this.#bodyUsed = true;

    // Signal to the browser what format we want
    await this.#duplex.write({responseType, status: "updating"});

    return new Promise((resolve, reject) => {
      const offData = this.#duplex.on("data", (task) => {
        if (task.done) {
          if (task.status === "rejected") {
            reject(task.result);
          } else {
            resolve(task.result);
          }
          offData();
          offClose();
          this.#duplex.destroy();
        }
      });
      const offClose = this.#duplex.on("close", () => {
        reject(new Error("Connection closed while reading body."));
        offData();
        offClose();
      });
    });
  }

  #getBody(): ReadableStream<Uint8Array> | null {
    if (this.#bodyUsed) {
      throw new TypeError("Body already used");
    }
    this.#bodyUsed = true;

    const self = this;
    let yieldedCount = 0;

    // Signal to the browser to start streaming
    self.#duplex.write({responseType: "stream", status: "updating"});

    return new ReadableStream({
      async pull(controller) {
        for await (const task of self.#duplex.stream()) {
          // Push new chunks to the stream
          for (let i = yieldedCount; i < task.chunks.length; i++) {
            controller.enqueue(task.chunks[i]);
          }
          yieldedCount = task.chunks.length;

          if (task.done) {
            if (task.status === "rejected") {
              controller.error(task.result);
            } else {
              controller.close();
            }
            // Stream is finished, stop listening.
            await self.#duplex.destroy();
            break;
          }
        }
      },
      cancel(reason) {
        console.warn("ReadableStream cancelled:", reason);
        self.#duplex.destroy();
      },
    });
  }

  #body?: ReadableStream<Uint8Array> | null;
  get body(): ReadableStream<Uint8Array> | null {
    if (this.#body === undefined) {
      this.#body = this.ok ? this.#getBody() : null;
    }
    return this.#body;
  }

  async json(): Promise<any> {
    return this.#readBody("json");
  }

  async text(): Promise<string> {
    return this.#readBody("text");
  }

  async arrayBuffer(): Promise<ArrayBuffer> {
    return this.#readBody("arrayBuffer");
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
      response: null,
      result: null,
      chunks: [],
      done: false,
    };

    const duplex = await runner<FetchTask>({dir, initialTask});

    return new Promise((resolve, reject) => {
      const offData = duplex.on("data", (task) => {
        // As soon as we get the headers back, we can resolve with the BrowserResponse
        if (task.status === "responded") {
          resolve(new BrowserResponse(duplex));
          offData(); // Stop listening for this specific event
          offClose();
        } else if (task.done) {
          // Task finished before even responding (e.g., error)
          reject(task.result || new Error("Task finished before responding."));
          offData();
          offClose();
          duplex.destroy();
        }
      });
      const offClose = duplex.on("close", () => {
        reject(new Error("Connection closed before fetch responded."));
        offData();
        offClose();
      });
    });
  };
};
