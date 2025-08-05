import type {FsDuplexMessage, FsDuplexMessageType, FsDuplexParty, FsDuplexPayloads} from "./protocol.js";

export type FsDuplexState = "opening" | "open" | "closing" | "closed";

// Actions are now generic to carry the application-specific payload type `T`.
type EmitAction<T> = {type: "emit"; event: "open" | "close" | FsDuplexMessageType; payload?: any};
type SendAction = {type: "send"; messageType: FsDuplexMessageType; payload: any};
export type Action<T> = EmitAction<T> | SendAction;

export interface ProcessResult<T> {
  actions: Action<T>[];
  newState: FsDuplexState;
  newLocalAck: number;
}

/**
 * A stateless rule engine for the FsDuplex protocol.
 * It processes an incoming message against the current state and returns a set of actions to be executed.
 * It is generic and does not know about the content of the data `T` it processes.
 */
export class MessageProcessor<T> {
  private party: FsDuplexParty;
  constructor(party: FsDuplexParty) {
    this.party = party;
  }

  public process(message: FsDuplexMessage, currentState: FsDuplexState, currentLocalAck: number): ProcessResult<T> {
    const actions: Action<T>[] = [];
    let newState = currentState;
    let newLocalAck = currentLocalAck;

    // Basic validation: ignore messages from self or old messages.
    if (message.from === this.party || message.seq <= currentLocalAck) {
      return {actions, newState, newLocalAck};
    }

    newLocalAck = message.seq;

    // The core data-emitting action. The payload is passed through opaquely.
    actions.push({type: "emit", event: message.type as FsDuplexMessageType, payload: message.payload});

    switch (currentState) {
      case "opening":
        if (this.party === "handler" && message.type === "init") {
          newState = "open";
          // If the init message carries a payload, generate a separate 'data' action.
          const initPayload = message.payload as FsDuplexPayloads<T>["init"];
          if (initPayload?.initial_payload !== undefined) {
            actions.push({type: "emit", event: "data", payload: initPayload.initial_payload});
          }
          actions.push({type: "emit", event: "open"});
          actions.push({type: "send", messageType: "ack", payload: null});
        } else if (this.party === "initiator" && message.type === "ack") {
          newState = "open";
          actions.push({type: "emit", event: "open"});
        }
        break;
      case "open":
        if (message.type === "fin") {
          // Graceful close initiated by the other party.
          newState = "closing";
          actions.push({type: "send", messageType: "fin_ack", payload: null});
          // Transition directly to closed, as we've acknowledged it.
          newState = "closed";
          actions.push({type: "emit", event: "close"});
        }
        // `data` messages are handled by the generic emit action at the start. No special state change needed.
        break;
      case "closing":
        // We have initiated a close, and are waiting for the final ack.
        // Or, both parties sent `fin` concurrently.
        if (message.type === "fin_ack" || message.type === "fin") {
          newState = "closed";
          actions.push({type: "emit", event: "close"});
        }
        break;
      case "closed":
        // No actions are taken on messages received in the closed state.
        break;
    }
    return {actions, newState, newLocalAck};
  }
}
