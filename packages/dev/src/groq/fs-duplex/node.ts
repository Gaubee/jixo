import fsp from "node:fs/promises";
import {FsDuplex} from "./common.js";
import {NodeHeartbeatReader} from "./heartbeat.js";
import type {JsonLike} from "./json.js";
import {NodeAppendOnlyLog} from "./log.js";
import type {FsDuplexParty} from "./protocol.js";

const HEARTBEAT_TIMEOUT = 10000;

export class NodeFsDuplex<T, P extends FsDuplexParty> extends FsDuplex<T, P> {
  private readonly heartbeatReader: NodeHeartbeatReader;
  private poller: NodeJS.Timeout | null = null;
  private heartbeatPoller: NodeJS.Timeout | null = null;
  private readonly pollInterval: number;
  private readonly heartbeatTimeout: number;
  private readonly filepaths: {read: string; write: string; heartbeat: string};

  constructor(party: P, json: JsonLike, filepathPrefix: string, options?: {pollInterval?: number; heartbeatTimeout?: number}) {
    const readFile = party === "initiator" ? `${filepathPrefix}.out.jsonl` : `${filepathPrefix}.in.jsonl`;
    const writeFile = party === "initiator" ? `${filepathPrefix}.in.jsonl` : `${filepathPrefix}.out.jsonl`;
    const heartbeatFile = `${filepathPrefix}.heartbeat.json`;

    const readerLog = new NodeAppendOnlyLog(readFile);
    const writerLog = new NodeAppendOnlyLog(writeFile);

    super(party, json, readerLog, writerLog);
    this.heartbeatReader = new NodeHeartbeatReader(heartbeatFile);
    this.pollInterval = options?.pollInterval ?? 200;
    this.heartbeatTimeout = options?.heartbeatTimeout ?? HEARTBEAT_TIMEOUT;
    this.filepaths = {read: readFile, write: writeFile, heartbeat: heartbeatFile};
  }

  public async start(): Promise<void> {
    if (this.poller) return;
    this.log("Starting...");
    await this.readerLog.start();
    await this.writerLog.start();

    this.poller = setInterval(() => this.handleIncomingData(), this.pollInterval);

    this.heartbeatPoller = setInterval(async () => {
      if (this.currentState === "open") {
        const alive = await this.heartbeatReader.isAlive(this.heartbeatTimeout);
        this.log("Heartbeat check: isAlive=%s", alive);
        if (!alive) {
          this.onError.emit(new Error("Heartbeat timeout"));
          this.close("timeout");
        }
      }
    }, this.heartbeatTimeout / 2);
  }

  public async stop(): Promise<void> {
    this.log("Stopping...");
    if (this.poller) clearInterval(this.poller);
    if (this.heartbeatPoller) clearInterval(this.heartbeatPoller);
    this.poller = null;
    this.heartbeatPoller = null;
    await this.readerLog.stop();
    await this.writerLog.stop();
    this.log("Stopped.");
  }

  public async destroy(): Promise<void> {
    this.log("Destroying...");
    await this.stop();
    await Promise.all([
      fsp.rm(this.filepaths.read, {force: true}).catch(() => {}),
      fsp.rm(this.filepaths.write, {force: true}).catch(() => {}),
      fsp.rm(this.filepaths.heartbeat, {force: true}).catch(() => {}),
    ]);
    this.log("Destroyed.");
  }
}
