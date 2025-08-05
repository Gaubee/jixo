import {afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi} from "vitest";
import {superjson} from "../common/coding.js";
import type {FetchTask} from "../common/fetch.js";
import {NodeFsDuplex} from "./fs-duplex.js";

import {delay} from "@gaubee/util";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";

// Helper function to create a unique temporary directory for tests
const createTestDir = async () => {
  const dirPath = path.join(os.tmpdir(), `fs-duplex-test-${crypto.randomUUID()}`);
  await fsp.mkdir(dirPath, {recursive: true});
  return dirPath;
};

describe("NodeFsDuplex", () => {
  let testDir: string;
  let taskFilepath: string;
  let initiatorDuplex: NodeFsDuplex<FetchTask> | undefined;
  let handlerDuplex: NodeFsDuplex<FetchTask> | undefined;

  // Setup a temporary directory for all tests in this suite
  beforeAll(async () => {
    testDir = await createTestDir();
  });

  // Create a fresh task file path for each test
  beforeEach(() => {
    taskFilepath = path.join(testDir, `task-${crypto.randomUUID()}.json`);
  });

  // Cleanup duplex instances and files after each test
  afterEach(async () => {
    await initiatorDuplex?.destroy();
    await handlerDuplex?.destroy();
    initiatorDuplex = undefined;
    handlerDuplex = undefined;
    // ensure file is removed, waiting a bit for the destroy timeout
    await delay(100);
    await fsp.rm(taskFilepath, {force: true}).catch(() => {});
  });

  // Cleanup the temporary directory after all tests are done
  afterAll(async () => {
    await fsp.rm(testDir, {recursive: true, force: true});
  });

  it("should establish a handshake correctly", async () => {
    const initialTask: FetchTask = {
      type: "fetch",
      taskId: "task-handshake",
      url: "test_url",
      init: {},
      status: "initial",
      response: null,
      result: null,
      chunks: [],
      done: false,
    };

    const handlerPromise = new Promise<FetchTask>((resolve) => {
      // Handler waits for the file to be created
      handlerDuplex = new NodeFsDuplex<FetchTask>(superjson, taskFilepath);
      handlerDuplex.on("open", (task) => {
        resolve(task);
      });
      handlerDuplex.start();
    });

    // Initiator creates the file and the duplex
    initiatorDuplex = new NodeFsDuplex<FetchTask>(superjson, taskFilepath, initialTask);
    initiatorDuplex.start();

    const receivedTask = await handlerPromise;
    expect(receivedTask).toEqual(initialTask);
  });

  it("should handle a simple request-response flow", async () => {
    const initialTask: FetchTask = {
      type: "fetch",
      taskId: "task-req-res",
      url: "test_url",
      init: {},
      status: "initial",
      response: null,
      result: null,
      chunks: [],
      done: false,
    };

    // 1. Setup handler to listen and respond
    handlerDuplex = new NodeFsDuplex<FetchTask>(superjson, taskFilepath);
    handlerDuplex.on("data", (task) => {
      if (task.status === "initial") {
        // On receiving initial task, handler "processes" it and responds
        handlerDuplex!.write({status: "fulfilled", result: "OK", done: true});
      }
    });
    handlerDuplex.start();

    // 2. Setup initiator to listen for the final result
    const initiatorPromise = new Promise<FetchTask>((resolve) => {
      initiatorDuplex = new NodeFsDuplex<FetchTask>(superjson, taskFilepath, initialTask);
      initiatorDuplex.on("data", (task) => {
        if (task.done) {
          resolve(task);
        }
      });
      initiatorDuplex.start();
    });

    const finalTask = await initiatorPromise;

    expect(finalTask.status).toBe("fulfilled");
    expect(finalTask.result).toBe("OK");
    expect(finalTask.done).toBe(true);
  });

  it("should correctly handle a streaming data flow", async () => {
    const initialTask: FetchTask = {
      type: "fetch",
      taskId: "task-stream",
      url: "test_stream_url",
      init: {},
      status: "initial",
      response: null,
      result: null,
      chunks: [],
      done: false,
    };

    const chunksToSend = [new Uint8Array([1, 1]), new Uint8Array([2, 2]), new Uint8Array([3, 3])];
    const receivedChunks: Uint8Array[] = [];

    // 1. Handler logic: responds to requests and streams data
    handlerDuplex = new NodeFsDuplex<FetchTask>(superjson, taskFilepath);
    handlerDuplex.on("data", async (task) => {
      if (task.status === "initial") {
        await handlerDuplex!.write({status: "responded", response: {headers: {}}});
      } else if (task.responseType === "stream") {
        // Start streaming chunks
        let currentChunks: Uint8Array<ArrayBuffer>[] = [];
        for (const chunk of chunksToSend) {
          currentChunks.push(chunk);
          await handlerDuplex!.write({chunks: [...currentChunks]});
          await delay(20); // Simulate network delay
        }
        // Finish streaming
        await handlerDuplex!.write({status: "fulfilled", done: true});
      }
    });

    // 2. Initiator logic: requests stream and consumes it
    const streamProcessing = async () => {
      initiatorDuplex = new NodeFsDuplex<FetchTask>(superjson, taskFilepath, initialTask);
      initiatorDuplex.start();

      // Wait for headers
      let task = await initiatorDuplex.nextData();
      expect(task.status).toBe("responded");

      // Request stream
      await initiatorDuplex.write({responseType: "stream"});

      // Consume stream
      let lastChunkCount = 0;
      for await (const streamTask of initiatorDuplex.stream()) {
        if (streamTask.chunks.length > lastChunkCount) {
          const newChunks = streamTask.chunks.slice(lastChunkCount);
          receivedChunks.push(...newChunks);
          lastChunkCount = streamTask.chunks.length;
        }
        if (streamTask.done) {
          break;
        }
      }
    };

    // 3. Run both and await completion
    handlerDuplex.start();
    await streamProcessing();

    // 4. Assertions
    expect(receivedChunks).toEqual(chunksToSend);
  });

  it("should notify the other party on destroy", async () => {
    const initialTask: FetchTask = {type: "fetch", taskId: "task-destroy"} as FetchTask;

    const closeListener = vi.fn();
    const handlerClosedPromise = new Promise<void>((resolve) => {
      handlerDuplex = new NodeFsDuplex(superjson, taskFilepath);
      handlerDuplex.on("close", () => {
        closeListener();
        resolve();
      });
      handlerDuplex.start();
    });

    initiatorDuplex = new NodeFsDuplex(superjson, taskFilepath, initialTask);
    initiatorDuplex.start();

    // Wait for handler to confirm it's listening
    await delay(100);

    // Initiator destroys the connection
    await initiatorDuplex.destroy();

    // Handler should get the close event
    await handlerClosedPromise;

    expect(closeListener).toHaveBeenCalled();
  });
});
