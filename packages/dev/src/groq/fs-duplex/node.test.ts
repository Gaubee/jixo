import {delay} from "@gaubee/util";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {afterEach, beforeEach, describe, expect, it} from "vitest";
import {NodeFsDuplex} from "./node.js";

// A mock data type for testing purposes
type TestData = {
  id?: number;
  message?: string;
  data?: Uint8Array;
};

class MockHeartbeatWriter {
  private timer: NodeJS.Timeout | null = null;
  constructor(
    private filepath: string,
    private interval = 500,
  ) {}
  async write() {
    await fsp.writeFile(this.filepath, String(Date.now()));
  }
  start() {
    if (this.timer) return;
    this.write();
    this.timer = setInterval(() => this.write(), this.interval);
  }
  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

describe("NodeFsDuplex Final Integration Test", () => {
  let testDir: string;
  let taskFilepathPrefix: string;
  let initiator: NodeFsDuplex<TestData, "initiator">;
  let handler: NodeFsDuplex<TestData, "handler">;
  let mockHeartbeat: MockHeartbeatWriter;

  // Use native JSON as the JsonLike implementation for tests
  const jsonImpl = JSON;

  beforeEach(async () => {
    testDir = path.join(os.tmpdir(), `fs-duplex-final-test-${crypto.randomUUID()}`);
    await fsp.mkdir(testDir, {recursive: true});
    taskFilepathPrefix = path.join(testDir, "task");

    // Default instances for most tests
    initiator = new NodeFsDuplex("initiator", jsonImpl, taskFilepathPrefix);
    handler = new NodeFsDuplex("handler", jsonImpl, taskFilepathPrefix);
    mockHeartbeat = new MockHeartbeatWriter(`${taskFilepathPrefix}.heartbeat.json`, 100);
  });

  afterEach(async () => {
    await initiator?.stop();
    await handler?.stop();
    mockHeartbeat.stop();
    await delay(100);
    await fsp.rm(testDir, {recursive: true, force: true}).catch(() => {});
  });

  it("should complete a full handshake", async () => {
    await initiator.start();
    await handler.start();
    mockHeartbeat.start();

    initiator.init({id: 1});

    await Promise.all([initiator.onOpen.once(), handler.onOpen.once()]);

    expect(initiator.currentState).toBe("open");
    expect(handler.currentState).toBe("open");
  });

  it("should send and receive messages bi-directionally after handshake", async () => {
    await initiator.start();
    await handler.start();
    mockHeartbeat.start();

    initiator.init();
    await initiator.onOpen.once();

    const handlerReceivedPromise = handler.onData.once();
    const initiatorReceivedPromise = initiator.onData.once();

    initiator.sendData({data: new Uint8Array([1, 2, 3])});
    handler.sendData({message: "pong"});

    const handlerPayload = await handlerReceivedPromise;
    const initiatorPayload = await initiatorReceivedPromise;

    expect(handlerPayload.data).toBeDefined();
    expect(initiatorPayload.message).toBe("pong");
  });

  it("should handle graceful shutdown from initiator", async () => {
    await initiator.start();
    await handler.start();
    mockHeartbeat.start();

    initiator.init();
    await initiator.onOpen.once();

    const initiatorClosed = initiator.onClose.once();
    const handlerClosed = handler.onClose.once();

    initiator.close();

    const [initiatorReason, handlerReason] = await Promise.all([initiatorClosed, handlerClosed]);

    expect(initiator.currentState).toBe("closed");
    expect(handler.currentState).toBe("closed");
    expect(initiatorReason).toBe("graceful");
    expect(handlerReason).toBe("graceful");
  });

  it("should handle graceful shutdown from handler", async () => {
    await initiator.start();
    await handler.start();
    mockHeartbeat.start();

    initiator.init();
    await initiator.onOpen.once();

    const initiatorClosed = initiator.onClose.once();
    const handlerClosed = handler.onClose.once();

    handler.close();

    const [initiatorReason, handlerReason] = await Promise.all([initiatorClosed, handlerClosed]);

    expect(initiator.currentState).toBe("closed");
    expect(handler.currentState).toBe("closed");
    expect(initiatorReason).toBe("graceful");
    expect(handlerReason).toBe("graceful");
  });

  it(
    "should close with 'timeout' reason when heartbeat fails",
    async () => {
      const shortTimeout = 500;
      initiator = new NodeFsDuplex("initiator", jsonImpl, taskFilepathPrefix, {
        heartbeatTimeout: shortTimeout,
      });
      handler = new NodeFsDuplex("handler", jsonImpl, taskFilepathPrefix);

      initiator.onError.on((err) => {
        expect(err.message).toBe("Heartbeat timeout");
      });

      await initiator.start();
      await handler.start();
      mockHeartbeat.start();

      initiator.init();
      await initiator.onOpen.once();
      expect(initiator.currentState).toBe("open");

      mockHeartbeat.stop();

      const closeReason = await initiator.onClose.once();
      expect(closeReason).toBe("timeout");
      expect(initiator.currentState).toBe("closed");
    },
    {timeout: 2000},
  );
});
