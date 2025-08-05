import {delay} from "@gaubee/util";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {afterEach, beforeEach, describe, expect, it} from "vitest";
import {NodeHeartbeatReader} from "./heartbeat.js";

describe("NodeHeartbeatReader", () => {
  let testDir: string;
  let heartbeatFilepath: string;
  let reader: NodeHeartbeatReader;
  const TIMEOUT = 1000; // 1 second timeout for tests

  beforeEach(async () => {
    testDir = path.join(os.tmpdir(), `heartbeat-test-${crypto.randomUUID()}`);
    await fsp.mkdir(testDir, {recursive: true});
    heartbeatFilepath = path.join(testDir, "test.heartbeat");
    reader = new NodeHeartbeatReader(heartbeatFilepath);
  });

  afterEach(async () => {
    await fsp.rm(testDir, {recursive: true, force: true}).catch(() => {});
  });

  it("should return true if the heartbeat is recent", async () => {
    const now = Date.now();
    await fsp.writeFile(heartbeatFilepath, String(now));

    const isAlive = await reader.isAlive(TIMEOUT);
    expect(isAlive).toBe(true);
  });

  it("should return false if the heartbeat is stale", async () => {
    const staleTimestamp = Date.now() - TIMEOUT * 2;
    await fsp.writeFile(heartbeatFilepath, String(staleTimestamp));

    const isAlive = await reader.isAlive(TIMEOUT);
    expect(isAlive).toBe(false);
  });

  it("should return false if the heartbeat file does not exist", async () => {
    const isAlive = await reader.isAlive(TIMEOUT);
    expect(isAlive).toBe(false);
  });

  it("should return false if the heartbeat file is corrupted", async () => {
    await fsp.writeFile(heartbeatFilepath, "not-a-timestamp");

    const isAlive = await reader.isAlive(TIMEOUT);
    expect(isAlive).toBe(false);
  });

  it("should reflect liveness over time", async () => {
    // Initially alive
    await fsp.writeFile(heartbeatFilepath, String(Date.now()));
    expect(await reader.isAlive(TIMEOUT)).toBe(true);

    // Wait for the timestamp to become stale
    await delay(TIMEOUT + 100);
    expect(await reader.isAlive(TIMEOUT)).toBe(false);

    // Write a new heartbeat
    await fsp.writeFile(heartbeatFilepath, String(Date.now()));
    expect(await reader.isAlive(TIMEOUT)).toBe(true);
  });
});
