import type {SuperJSON} from "superjson";
import {FsDuplex} from "./common.js";
import {NodeHeartbeatReader} from "./heartbeat.js";
import {NodeAppendOnlyLog} from "./log.js";
import type {FsDuplexParty} from "./protocol.js";

const HEARTBEAT_TIMEOUT = 10000; // 10 seconds

export class NodeFsDuplex<P extends FsDuplexParty> extends FsDuplex<P> {
  private heartbeatReader: NodeHeartbeatReader;
  private poller: NodeJS.Timeout | null = null;
  private heartbeatPoller: NodeJS.Timeout | null = null;
  // Node needs to know about both files to create the correct log reader/writer
  private readonly filepathPrefix: string;

  constructor(party: P, superjson: SuperJSON, filepathPrefix: string) {
    const localLogFile = party === "initiator" ? `${filepathPrefix}.in.jsonl` : `${filepathPrefix}.out.jsonl`;
    const remoteLogFile = party === "initiator" ? `${filepathPrefix}.out.jsonl` : `${filepathPrefix}.in.jsonl`;
    const heartbeatFilepath = `${filepathPrefix}.heartbeat.json`;

    // We READ from the remote's log file.
    super(party, superjson, new NodeAppendOnlyLog(remoteLogFile));
    this.filepathPrefix = filepathPrefix;
    this.heartbeatReader = new NodeHeartbeatReader(heartbeatFilepath);
  }

  public start(): void {
    if (this.poller) return;
    this.log.start();
    this.poller = setInterval(() => this.channel.handleLogData(), 50);
    this.heartbeatPoller = setInterval(async () => {
      if (this.state === "open" || this.state === "opening") {
        const alive = await this.heartbeatReader.isAlive(HEARTBEAT_TIMEOUT);
        if (!alive) {
          this.emit("error", new Error("Heartbeat timeout"));
          this.stop();
          this.emit("close", "timeout");
        }
      }
    }, HEARTBEAT_TIMEOUT / 2);
  }

  public stop(): void {
    if (this.poller) {
      clearInterval(this.poller);
      this.poller = null;
    }
    if (this.heartbeatPoller) {
      clearInterval(this.heartbeatPoller);
      this.heartbeatPoller = null;
    }
    this.log.stop();
  }
}
