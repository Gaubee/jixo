import {pureEvent, type PureEvent} from "@gaubee/util";
import Debug from "debug";
import type {JsonLike} from "./json.js";
import type {AppendOnlyLog} from "./log.js";
import type {Action} from "./processor.js";
import {MessageProcessor} from "./processor.js";
import type {FsDuplexMessage, FsDuplexMessageType, FsDuplexParty, FsDuplexPayloads} from "./protocol.js";

export type {FsDuplexBrowserHelper} from "./browser.js";

/**
 * An abstract base class for a duplex communication channel over a filesystem.
 * It is generic over the application data type `T` and the party `P`.
 *
 * It handles the protocol state machine, message sequencing, and serialization,
 * while delegating platform-specific file I/O to subclasses.
 */
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

  // --- Public Events ---
  public readonly onOpen = pureEvent<void>();
  public readonly onClose = pureEvent<string>(); // reason
  public readonly onError = pureEvent<Error>();
  public readonly onData = pureEvent<T>();

  // --- Protocol-level Events (for advanced use cases) ---
  public readonly onInit = pureEvent<FsDuplexPayloads<T>["init"]>();
  public readonly onAck = pureEvent<FsDuplexPayloads<T>["ack"]>();
  public readonly onFin = pureEvent<FsDuplexPayloads<T>["fin"]>();
  public readonly onFinAck = pureEvent<FsDuplexPayloads<T>["fin_ack"]>();
  public readonly onPing = pureEvent<FsDuplexPayloads<T>["ping"]>();
  public readonly onPong = pureEvent<FsDuplexPayloads<T>["pong"]>();

  private readonly protocolEvents: Record<FsDuplexMessageType, PureEvent<any>> = {
    init: this.onInit,
    ack: this.onAck,
    fin: this.onFin,
    fin_ack: this.onFinAck,
    ping: this.onPing,
    pong: this.onPong,
    data: this.onData,
  };

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

  private _sendMessage<M extends FsDuplexMessageType>(type: M, payload: FsDuplexPayloads<T>[M]): void {
    if (this.state === "closed") return;
    if (this.state === "closing" && type !== "fin" && type !== "fin_ack") return;
    this.localSeq++;
    const message: FsDuplexMessage = {from: this.party, seq: this.localSeq, ack: this.localAck, type, payload};
    this.log("Sending message: %o", message);
    const line = this.json.stringify(message);
    this.writerLog.append(line).catch((err) => this.onError.emit(err));
  }

  private _executeAction(action: Action<T>): void {
    if (action.type === "emit") {
      this.log("Emitting event: %s with payload: %o", action.event, action.payload);
      if (action.event === "open") {
        this.onOpen.emit();
      } else if (action.event === "close") {
        this.state = "closed";
        this.log("State change: %s", this.state);
        this.onClose.emit("graceful");
      } else {
        const event_emitter = this.protocolEvents[action.event as FsDuplexMessageType];
        if (event_emitter) {
          event_emitter.emit(action.payload);
        }
      }
    } else if (action.type === "send") {
      this._sendMessage(action.messageType, action.payload);
    }
  }
}
