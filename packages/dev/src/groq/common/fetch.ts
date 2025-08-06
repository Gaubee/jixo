import {z} from "zod/v4-mini";
import type {NodeFsDuplex} from "../fs-duplex/node.js";
import type {TaskRunner} from "../node/utils.js";
import type {TaskHandler} from "./task-handlers.js";
import {TaskError, waitNextTask} from "./utils.js";

// 1. Zod 定义 (The Contract) - no changes
export const zFetchTask = z.object({
  type: z.literal("fetch"),
  taskId: z.string(),
  url: z.string(),
  init: z.any(),
  responseType: z.optional(z.enum(["json", "text", "arrayBuffer", "stream"])),
  status: z.enum(["initial", "pending", "responded", "streaming", "updating", "fulfilled", "rejected"]),
  response: z.any(),
  result: z.any(),
  chunks: z.array(z.instanceof(Uint8Array)),
  done: z.boolean(),
});
export type FetchTask = z.output<typeof zFetchTask>;

// 2. Browser 状态处理函数 (The Browser-side Logic)
export const doFetch: TaskHandler<FetchTask> = async (duplex, initialTask) => {
  let output = {...initialTask};
  try {
    const response = await fetch(output.url, output.init);
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => (responseHeaders[key] = value));

    // Send the initial response headers and status back to Node.js
    output.status = "responded";
    output.response = {
      headers: responseHeaders,
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
    };
    duplex.sendData(output);

    // If the response was not OK, we still send the headers, but then we are done.
    if (!response.ok) {
      output.status = "rejected";
      output.result = `Request failed with status ${response.status}`;
      // No need to wait for further instructions, the task is complete.
    } else {
      // Wait for Node.js to tell us how to process the body.
      const update = await waitNextTask(duplex);
      Object.assign(output, update);

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

          output.status = "streaming";
          duplex.sendData(output); // Inform Node that streaming has started

          while (true) {
            const {done, value} = await reader.read();
            if (done) break;
            // Send chunks as they arrive.
            output.chunks.push(new Uint8Array(value));
            duplex.sendData(output);
          }
          break;
      }
      output.status = "fulfilled";
    }
  } catch (e) {
    // Catch errors from fetch() itself, waitNextTask() (TaskError), or body processing.
    output.status = "rejected";
    if (e instanceof TaskError) {
      // This is a controlled shutdown from the other side, no need to report an error payload.
      console.log(`Fetch task for ${output.taskId} aborted by initiator.`);
    } else {
      output.result = e instanceof Error ? {message: e.message, name: e.name, stack: e.stack} : e;
    }
  } finally {
    output.done = true;
    // Send the final state to Node.js, unless it was a remote close.
    if (output.status !== "rejected" || output.result) {
      duplex.sendData(output);
    }
  }
};

// 3. Node 状态处理函数 (The Node-side Initiator Factory) - no changes yet
class BrowserResponse {
  public readonly headers: Headers;
  public readonly ok: boolean;
  public readonly status: number;
  public readonly statusText: string;

  #duplex: NodeFsDuplex<FetchTask, "initiator">;
  #bodyUsed = false;
  #currentTask: FetchTask;

  constructor(duplex: NodeFsDuplex<FetchTask, "initiator">, initialTask: FetchTask) {
    this.#duplex = duplex;
    this.#currentTask = initialTask;
    this.headers = new Headers(initialTask.response.headers);
    this.ok = initialTask.response.ok;
    this.status = initialTask.response.status;
    this.statusText = initialTask.response.statusText;
  }

  async #readBody(responseType: FetchTask["responseType"]): Promise<any> {
    if (this.#bodyUsed) throw new TypeError(`Body has already been used.`);
    this.#bodyUsed = true;

    // Explicitly cast to FetchTask to satisfy the type checker
    this.#duplex.sendData({responseType, status: "updating"} as FetchTask);

    return new Promise((resolve, reject) => {
      const offData = this.#duplex.onData.on((task) => {
        this.#currentTask = task;
        if (task.done) {
          cleanup();
          if (task.status === "rejected") {
            reject(task.result);
          } else {
            resolve(task.result);
          }
        }
      });
      const offClose = this.#duplex.onClose.on((reason) => {
        cleanup();
        reject(new Error(`Connection closed while reading body. Reason: ${reason}`));
      });
      const cleanup = () => {
        offData();
        offClose();
      };
    });
  }

  get body(): ReadableStream<Uint8Array> | null {
    if (this.#bodyUsed) throw new TypeError("Body already used");
    this.#bodyUsed = true;
    if (!this.ok) return null;

    this.#duplex.sendData({responseType: "stream", status: "updating"} as FetchTask);

    let yieldedCount = 0;

    return new ReadableStream({
      start: (controller) => {
        const offData = this.#duplex.onData.on((task) => {
          this.#currentTask = task;
          for (let i = yieldedCount; i < task.chunks.length; i++) {
            controller.enqueue(task.chunks[i]);
          }
          yieldedCount = task.chunks.length;
          if (task.done) {
            cleanup();
            if (task.status === "rejected") controller.error(task.result);
            else controller.close();
          }
        });
        const offClose = this.#duplex.onClose.on((reason) => {
          cleanup();
          controller.error(new Error(`Connection closed during streaming. Reason: ${reason}`));
        });
        const cleanup = () => {
          offData();
          offClose();
        };
      },
      cancel: (reason) => {
        this.#duplex.close();
      },
    });
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
      const offData = duplex.onData.on((task) => {
        if (task.status === "responded") {
          cleanup();
          resolve(new BrowserResponse(duplex, task));
        } else if (task.done) {
          cleanup();
          reject(task.result || new Error("Task finished before responding."));
        }
      });
      const offClose = duplex.onClose.on((reason) => {
        cleanup();
        reject(new Error(`Connection closed before fetch responded. Reason: ${reason}`));
      });
      const cleanup = () => {
        offData();
        offClose();
      };
    });
  };
};
