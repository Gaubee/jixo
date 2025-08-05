import {delay} from "@gaubee/util";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {afterEach, beforeEach, describe, expect, it} from "vitest";
import {NodeAppendOnlyLog} from "./log.js";

describe("NodeAppendOnlyLog", () => {
  let testDir: string;
  let logFilepath: string;
  let log: NodeAppendOnlyLog;

  beforeEach(async () => {
    testDir = path.join(os.tmpdir(), `log-test-${crypto.randomUUID()}`);
    await fsp.mkdir(testDir, {recursive: true});
    logFilepath = path.join(testDir, "test.log");
    log = new NodeAppendOnlyLog(logFilepath);
    await log.start();
  });

  afterEach(async () => {
    await log.stop();
    await fsp.rm(testDir, {recursive: true, force: true}).catch(() => {});
  });

  it("should append and read a single line", async () => {
    await log.append('{"event": "start"}');
    const lines = await log.readNewLines();
    expect(lines).toEqual(['{"event": "start"}']);
  });

  it("should handle multiple appends and incremental reads", async () => {
    await log.append("line 1");
    let lines = await log.readNewLines();
    expect(lines).toEqual(["line 1"]);

    lines = await log.readNewLines();
    expect(lines).toEqual([]);

    await log.append("line 2");
    await log.append("line 3");
    lines = await log.readNewLines();
    expect(lines).toEqual(["line 2", "line 3"]);
  });

  it("should correctly handle incomplete last lines", async () => {
    await log.stop();
    await fsp.writeFile(logFilepath, "complete line\nincomplete li");

    await log.start();

    let lines = await log.readNewLines();
    expect(lines).toEqual(["complete line"]);

    await fsp.appendFile(logFilepath, "ne\nand another line\n");

    lines = await log.readNewLines();
    expect(lines).toEqual(["incomplete line", "and another line"]);

    lines = await log.readNewLines();
    expect(lines).toEqual([]);
  });

  it("should handle concurrent appends without data loss", async () => {
    const promises = [];
    for (let i = 0; i < 100; i++) {
      promises.push(log.append(`message ${i}`));
    }
    await Promise.all(promises);

    const lines = await log.readNewLines();
    expect(lines.length).toBe(100);
    const lineSet = new Set(lines);
    expect(lineSet.size).toBe(100);
    for (let i = 0; i < 100; i++) {
      expect(lineSet.has(`message ${i}`)).toBe(true);
    }
  });

  it("should handle reading from an empty file", async () => {
    const lines = await log.readNewLines();
    expect(lines).toEqual([]);
  });

  it("should handle appending to an empty file", async () => {
    await log.append("first line");
    const lines = await log.readNewLines();
    expect(lines).toEqual(["first line"]);
  });

  it("should handle multiple read calls correctly, even with delays", async () => {
    await log.append("A");
    expect(await log.readNewLines()).toEqual(["A"]);

    await delay(50);
    expect(await log.readNewLines()).toEqual([]);

    await log.append("B");
    await log.append("C");
    expect(await log.readNewLines()).toEqual(["B", "C"]);
  });
});
