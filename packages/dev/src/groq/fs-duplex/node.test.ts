import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {afterEach, beforeEach, describe, expect, it} from "vitest";
import {NodeFsDuplex} from "./node.js";
import {superjson} from "./superjson.js";

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
    private interval = 100,
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

describe("NodeFsDuplex Integration Test", () => {
  let testDir: string;
  let taskFilepathPrefix: string;
  let initiator: NodeFsDuplex<TestData, "initiator">;
  let handler: NodeFsDuplex<TestData, "handler">;
  let mockHeartbeat: MockHeartbeatWriter;

  beforeEach(async () => {
    testDir = path.join(os.tmpdir(), `fs-duplex-node-test-${crypto.randomUUID()}`);
    await fsp.mkdir(testDir, {recursive: true});
    taskFilepathPrefix = path.join(testDir, "task");

    initiator = new NodeFsDuplex("initiator", superjson, taskFilepathPrefix);
    handler = new NodeFsDuplex("handler", superjson, taskFilepathPrefix);
    mockHeartbeat = new MockHeartbeatWriter(`${taskFilepathPrefix}.heartbeat.json`);
  });

  afterEach(async () => {
    await initiator?.stop();
    await handler?.stop();
    mockHeartbeat.stop();
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

  it("should send and receive data bi-directionally", async () => {
    await initiator.start();
    await handler.start();
    mockHeartbeat.start();
    initiator.init();
    await initiator.onOpen.once();

    const handlerData = handler.onData.once();
    const initiatorData = initiator.onData.once();

    initiator.sendData({message: "ping"});
    handler.sendData({message: "pong"});

    await expect(handlerData).resolves.toEqual({message: "ping"});
    await expect(initiatorData).resolves.toEqual({message: "pong"});
  });

  it("should handle graceful shutdown", async () => {
    await initiator.start();
    await handler.start();
    mockHeartbeat.start();
    initiator.init();
    await initiator.onOpen.once();

    const initiatorClosed = initiator.onClose.once();
    const handlerClosed = handler.onClose.once();

    initiator.close();

    const [initiatorReason, handlerReason] = await Promise.all([initiatorClosed, handlerClosed]);

    expect(initiatorReason).toBe("graceful");
    expect(handlerReason).toBe("graceful");
  });

  it("should close with timeout when heartbeat fails", async () => {
    const shortTimeout = 200;
    initiator = new NodeFsDuplex("initiator", superjson, taskFilepathPrefix, {heartbeatTimeout: shortTimeout});

    await initiator.start();
    await handler.start();
    mockHeartbeat.start();
    initiator.init();
    await initiator.onOpen.once();

    const closeReason = initiator.onClose.once();
    mockHeartbeat.stop();

    await expect(closeReason).resolves.toBe("timeout");
  });

  it("should destroy and clean up all related files", async () => {
    await initiator.start();
    await handler.start();
    mockHeartbeat.start();
    initiator.init();
    await initiator.onOpen.once();

    // Ensure files exist before destroying
    await expect(fsp.access(`${taskFilepathPrefix}.in.jsonl`)).resolves.toBeUndefined();
    await expect(fsp.access(`${taskFilepathPrefix}.out.jsonl`)).resolves.toBeUndefined();
    await expect(fsp.access(`${taskFilepathPrefix}.heartbeat.json`)).resolves.toBeUndefined();

    await initiator.destroy();

    // Ensure files are gone after destroying
    await expect(fsp.access(`${taskFilepathPrefix}.in.jsonl`)).rejects.toThrow();
    await expect(fsp.access(`${taskFilepathPrefix}.out.jsonl`)).rejects.toThrow();
    await expect(fsp.access(`${taskFilepathPrefix}.heartbeat.json`)).rejects.toThrow();
  });
});
