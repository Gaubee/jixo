import {z} from "zod/v4-mini";
import type {TaskRunner} from "../node/utils.js";

// 1. Zod 定义
export const zFetchTask = z.object({
  type: z.literal("fetch"),
  taskId: z.string(),
  url: z.string(),
  init: z.any(), // Corresponds to RequestInit
  responseType: z.optional(z.enum(["json", "text", "arrayBuffer", "stream"])),
  status: z.enum(["initial", "pending", "responded", "updating", "fulfilled", "rejected"]),
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

    while (true) {
      if (output.responseType) break;
      yield {changed: false, output};
    }

    // if (!response.ok) {
    //   throw new Error(`HTTP error! status: ${response.status} ${response.statusText}`);
    // }

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
        while (true) {
          const {done, value} = await reader.read();
          if (done) break;
          // FIX: Create a new Uint8Array to ensure it's not backed by a SharedArrayBuffer.
          output.chunks.push(new Uint8Array(value));
          yield {changed: true, output};
        }
        break;
    }
    output.status = "fulfilled";
  } catch (e) {
    output.status = "rejected";
    output.result = e;
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

  #dir: string;
  #task: FetchTask;
  #runner: TaskRunner;
  #bodyUsed = false;

  constructor(dir: string, task: FetchTask, runner: TaskRunner) {
    this.#dir = dir;
    this.#task = task;
    this.#runner = runner;
    this.headers = new Headers(task.response.headers);
    this.ok = task.response.ok;
    this.status = task.response.status;
    this.statusText = task.response.statusText;
  }
  #getBody(): ReadableStream<Uint8Array> | null {
    if (this.#bodyUsed) {
      throw new TypeError("Body already used");
    }
    this.#bodyUsed = true;

    const self = this;
    return new ReadableStream({
      async pull(controller) {
        let yieldedCount = 0;
        let currentTask = self.#task;

        console.log("QAQ start reading", 0);
        // Start the stream reading on the browser side
        await self.#readBody("stream", false);
        console.log("QAQ start reading", 1);

        while (!currentTask.done) {
          currentTask = await self.#runner<FetchTask>({
            dir: self.#dir,
            poll: {taskId: self.#task.taskId, type: self.#task.type},
            waitUntil: (task) => task.chunks.length > yieldedCount || task.done,
          });
          console.log("QAQ start reading", 2, yieldedCount);

          for (let i = yieldedCount; i < currentTask.chunks.length; i++) {
            controller.enqueue(currentTask.chunks[i]);
          }
          yieldedCount = currentTask.chunks.length;

          if (currentTask.done) break;
        }
        console.log("QAQ start reading", 3);

        if (currentTask.status === "rejected") {
          controller.error(currentTask.result);
        } else {
          controller.close();
        }
      },
    });
  }
  #body?: ReadableStream<Uint8Array> | null;

  get body(): ReadableStream<Uint8Array> | null {
    if (this.#body === undefined) {
      this.#body = this.#getBody();
    }
    return this.#body;
  }

  async #readBody(responseType: FetchTask["responseType"], waitForDone = true): Promise<any> {
    if (this.#bodyUsed && responseType !== "stream") {
      throw new TypeError(`Already read by ${responseType}`);
    }
    this.#bodyUsed = true;

    const finalTask = await this.#runner<FetchTask>({
      dir: this.#dir,
      update: {
        taskId: this.#task.taskId,
        type: this.#task.type,
        payload: {responseType: responseType, status: "updating"},
      },
      waitUntil: (task) => (waitForDone ? task.done : task.status === "fulfilled") || task.status === "rejected",
    });
    this.#task = finalTask;

    if (finalTask.status === "rejected") throw finalTask.result;

    return finalTask.result;
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
    const respondedTask = await runner<FetchTask>({
      dir,
      initialTask,
      waitUntil: (task) => task.status === "responded" || task.done,
    });
    return new BrowserResponse(dir, respondedTask, runner);
  };
};
