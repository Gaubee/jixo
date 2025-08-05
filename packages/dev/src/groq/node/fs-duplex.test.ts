import {afterAll, afterEach, beforeAll, beforeEach, describe, expect, it} from "vitest";
import {superjson} from "../common/coding.js";
import type {FetchTask} from "../common/fetch.js";
import {NodeFsDuplex} from "./fs-duplex.js";

import {delay} from "@gaubee/util";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const debug = (id: string, ...args: any[]) => console.log(`[${id}]`, ...args);

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
    await delay(100);
    await fsp.rm(taskFilepath, {force: true}).catch(() => {});
  });

  // Cleanup the temporary directory after all tests are done
  afterAll(async () => {
    await fsp.rm(testDir, {recursive: true, force: true});
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

    const chunksToSend: Uint8Array<ArrayBuffer>[] = [new Uint8Array([1, 1]), new Uint8Array([2, 2]), new Uint8Array([3, 3])];
    const receivedChunks: Uint8Array<ArrayBuffer>[] = [];

    // 1. Handler logic: responds to requests and streams data
    handlerDuplex = await NodeFsDuplex.create<FetchTask>(superjson, taskFilepath, "Handler");
    handlerDuplex.on("data", async (task) => {
      debug("test.handler", "ON_DATA", task);
      if (task.status === "initial") {
        debug("test.handler", "WRITING status:responded");
        await handlerDuplex!.write({status: "responded", response: {headers: {}}});
      } else if (task.responseType === "stream") {
        debug("test.handler", "STARTING_STREAM");
        let currentChunks: Uint8Array<ArrayBuffer>[] = [];
        for (const chunk of chunksToSend) {
          currentChunks.push(chunk);
          debug("test.handler", "WRITING_CHUNK", chunk);
          await handlerDuplex!.write({chunks: [...currentChunks]});
          await delay(20); // Simulate network delay
        }
        debug("test.handler", "WRITING_DONE");
        await handlerDuplex!.write({status: "fulfilled", done: true});
      }
    });

    // 2. Initiator logic: requests stream and consumes it
    const streamProcessing = async () => {
      // FIX: Create initiator first and await its creation, which writes the file.
      initiatorDuplex = await NodeFsDuplex.create<FetchTask>(superjson, taskFilepath, "Initiator", initialTask);

      // FIX: Only start the handler after the file is guaranteed to exist.
      handlerDuplex!.start();
      initiatorDuplex.start();

      debug("test.initiator", "AWAITING_HEADERS");
      let task = await initiatorDuplex.nextData();
      debug("test.initiator", "GOT_HEADERS_TASK", task);
      expect(task.status).toBe("responded");

      debug("test.initiator", "WRITING responseType:stream");
      await initiatorDuplex.write({responseType: "stream"});

      debug("test.initiator", "STARTING_CONSUME_STREAM");
      let lastChunkCount = 0;
      for await (const streamTask of initiatorDuplex.stream()) {
        debug("test.initiator", "STREAM_YIELDED", streamTask);
        if (streamTask.chunks.length > lastChunkCount) {
          const newChunks = streamTask.chunks.slice(lastChunkCount);
          debug("test.initiator", "RECEIVED_NEW_CHUNKS", newChunks);
          receivedChunks.push(...newChunks);
          lastChunkCount = streamTask.chunks.length;
        }
        if (streamTask.done) {
          debug("test.initiator", "STREAM_DONE_FLAG_SEEN, breaking loop");
          break;
        }
      }
      debug("test.initiator", "STREAM_CONSUME_LOOP_ENDED");
    };

    // 3. Run both and await completion
    await streamProcessing();

    // 4. Assertions
    expect(receivedChunks).toEqual(chunksToSend);
  }, 10000);
});
