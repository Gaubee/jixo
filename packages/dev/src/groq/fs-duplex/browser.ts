import {FsDuplex} from "./common.js";
import {BrowserHeartbeatWriter} from "./heartbeat.js";
import type {JsonLike} from "./json.js";
import {BrowserAppendOnlyLog} from "./log.js";
import type {FsDuplexParty} from "./protocol.js";

export interface FsDuplexBrowserHelper {
  getFileHandle(filename: string): Promise<FileSystemFileHandle>;
  // Add a remove method to the helper interface
  removeFile(filename: string): Promise<void>;
}

export class BrowserFsDuplex<T, P extends FsDuplexParty> extends FsDuplex<T, P> {
  private readonly heartbeatWriter: BrowserHeartbeatWriter;
  private pollerId: any | null = null;
  private isPolling = false;
  private readonly filepaths: {read: string; write: string; heartbeat: string};
  private helper: FsDuplexBrowserHelper;

  constructor(party: P, json: JsonLike, filenamePrefix: string, helper: FsDuplexBrowserHelper) {
    const prefixBasename = filenamePrefix.split("/").pop()!;
    const readFile = party === "handler" ? `${prefixBasename}.in.jsonl` : `${prefixBasename}.out.jsonl`;
    const writeFile = party === "handler" ? `${prefixBasename}.out.jsonl` : `${prefixBasename}.in.jsonl`;
    const heartbeatFile = `${prefixBasename}.heartbeat.json`;

    const readerLog = new BrowserAppendOnlyLog(readFile, helper);
    const writerLog = new BrowserAppendOnlyLog(writeFile, helper);

    super(party, json, readerLog, writerLog);
    this.helper = helper;
    this.heartbeatWriter = new BrowserHeartbeatWriter(heartbeatFile, helper);
    this.filepaths = {read: readFile, write: writeFile, heartbeat: heartbeatFile};
  }

  public async start(): Promise<void> {
    if (this.pollerId) return;
    await this.readerLog.start();
    await this.writerLog.start();
    this.heartbeatWriter.start();
    this._poll();
  }

  public async stop(): Promise<void> {
    if (this.pollerId) {
      clearTimeout(this.pollerId);
      this.pollerId = null;
    }
    this.heartbeatWriter.stop();
    await this.readerLog.stop();
    await this.writerLog.stop();
  }

  public override close(reason: "done" | "error" | "timeout" = "done"): void {
    if (this.currentState === "closing" || this.currentState === "closed") return;
    this.heartbeatWriter.stop();
    super.close(reason);
  }

  public async destroy(): Promise<void> {
    this.log("Destroying...");
    await this.stop();
    await Promise.all([
      this.helper.removeFile(this.filepaths.read).catch(() => {}),
      this.helper.removeFile(this.filepaths.write).catch(() => {}),
      this.helper.removeFile(this.filepaths.heartbeat).catch(() => {}),
    ]);
    this.log("Destroyed.");
  }

  private _poll(): void {
    if (this.currentState === "closed") {
      return;
    }
    this.pollerId = setTimeout(async () => {
      if (!this.pollerId || this.isPolling) {
        return;
      }
      this.isPolling = true;
      try {
        await this.handleIncomingData();
      } catch (e) {
        this.onError.emit(e instanceof Error ? e : new Error(String(e)));
        this.close("error");
      } finally {
        this.isPolling = false;
        if (this.currentState !== "closed") {
          this._poll();
        }
      }
    }, 200);
  }
}
