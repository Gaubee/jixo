import {pureEvent} from "@gaubee/util";
import Debug from "debug";
import type {JsonLike} from "./json.js";
import type {AppendOnlyLog} from "./log.js";
import type {Action} from "./processor.js";
import {MessageProcessor} from "./processor.js";
import type {FsDuplexMessage, FsDuplexMessageType, FsDuplexParty} from "./protocol.js";

export abstract class FsDuplex<T, P extends FsDuplexParty> {
  public readonly party: P;
  protected json: JsonLike;
  protected readerLog: AppendOnlyLog;
  protected writerLog: AppendOnlyLog;

  private processor: MessageProcessor<T>;
  private state: "opening" | "open" | "closing" | "closed" = "opening";
  private localSeq = 0;
  private localAck = 0;
  protected readonly log: Debug.Debugger;

  // --- Public Events (Minimized API) ---
  public readonly onOpen = pureEvent<void>();
  public readonly onClose = pureEvent<string>(); // reason
  public readonly onError = pureEvent<Error>();
  public readonly onData = pureEvent<T>();

  public get currentState() {
    return this.state;
  }

  constructor(party: P, json: JsonLike, readerLog: AppendOnlyLog, writerLog: AppendOnlyLog) {
    this.party = party;
    this.json = json;
    this.readerLog = readerLog;
    this.writerLog = writerLog;
    this.processor = new MessageProcessor<T>(party);
    this.log = Debug(`jixo:fs-duplex:${party}`);
    this.log("Created.");
  }

  abstract start(): Promise<void>;
  abstract stop(): Promise<void>;
  abstract destroy(): Promise<void>;

  protected async handleIncomingData(): Promise<void> {
    const lines = await this.readerLog.readNewLines();
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        if (this.state === "closed") return;
        const message = this.json.parse<FsDuplexMessage>(line);
        this.log("Received message: %o", message);
        const result = this.processor.process(message, this.state, this.localAck);
        for (const action of result.actions) {
          this._executeAction(action);
        }
        if (this.state !== result.newState) {
          this.log("State change: %s -> %s", this.state, result.newState);
          this.state = result.newState;
        }
        this.localAck = result.newLocalAck;
      } catch (error) {
        this.onError.emit(error instanceof Error ? error : new Error(String(error)));
      }
    }
  }

  public sendData(payload: T): void {
    this._sendMessage("data", payload);
  }

  public init(initial_payload?: T): void {
    if (this.party !== "initiator") throw new Error("Only the initiator can start the connection with init().");
    this._sendMessage("init", {initial_payload});
  }

  public close(reason: "done" | "error" | "timeout" = "done"): void {
    this.log("Close called with reason: %s. Current state: %s", reason, this.state);
    if (this.state === "closing" || this.state === "closed") return;
    this.state = "closing";
    this.log("State change: %s", this.state);
    this._sendMessage("fin", {reason});
    if (reason === "timeout" || reason === "error") {
      this.state = "closed";
      this.log("State change: %s (immediate due to %s)", this.state, reason);
      this.onClose.emit(reason);
    }
  }

  private _sendMessage<M extends FsDuplexMessageType>(type: M, payload: any): void {
    if (this.state === "closed") return;
    if (this.state === "closing" && type !== "fin" && type !== "fin_ack") return;
    this.localSeq++;
    const message: FsDuplexMessage = {from: this.party, seq: this.localSeq, ack: this.localAck, type, payload};
    this.log("Sending message: %o", message);
    const line = this.json.stringify(message);
    this.writerLog.append(line).catch((err) => this.onError.emit(err));
  }

  private _executeAction(action: Action<T>): void {
    this.log("Executing action: %o", action);
    if (action.type === "emit") {
      switch (action.event) {
        case "open":
          this.onOpen.emit();
          break;
        case "close":
          this.state = "closed";
          this.log("State change: %s", this.state);
          this.onClose.emit("graceful");
          break;
        case "data":
          this.onData.emit(action.payload);
          break;
        // All other low-level protocol events are now handled internally
        // and do not need to be emitted publicly.
      }
    } else if (action.type === "send") {
      this._sendMessage(action.messageType, action.payload);
    }
  }
}
