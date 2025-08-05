import {describe, expect, it} from "vitest";
import {MessageProcessor} from "./processor.js";
import type {FsDuplexMessage} from "./protocol.js";

describe("MessageProcessor (Stateless Rule Engine)", () => {
  it("handler should generate correct actions on 'init' message", () => {
    const processor = new MessageProcessor<any>("handler");
    const initMessage: FsDuplexMessage = {from: "initiator", seq: 1, ack: 0, type: "init", payload: {}};
    const result = processor.process(initMessage, "opening", 0);
    expect(result.newState).toBe("open");
    expect(result.newLocalAck).toBe(1);
    expect(result.actions).toEqual([
      {type: "emit", event: "init", payload: {}},
      {type: "emit", event: "open"},
      {type: "send", messageType: "ack", payload: null},
    ]);
  });

  it("handler should emit 'data' if 'init' message contains an initial_payload", () => {
    const processor = new MessageProcessor<{value: string}>("handler");
    const initMessage: FsDuplexMessage = {
      from: "initiator",
      seq: 1,
      ack: 0,
      type: "init",
      payload: {initial_payload: {value: "hello"}},
    };
    const result = processor.process(initMessage, "opening", 0);
    // The test now expects the full sequence of actions in order.
    expect(result.actions).toEqual([
      {type: "emit", event: "init", payload: {initial_payload: {value: "hello"}}},
      {type: "emit", event: "data", payload: {value: "hello"}},
      {type: "emit", event: "open"},
      {type: "send", messageType: "ack", payload: null},
    ]);
  });

  it("initiator should transition to 'open' on 'ack' message", () => {
    const processor = new MessageProcessor<any>("initiator");
    const ackMessage: FsDuplexMessage = {from: "handler", seq: 1, ack: 1, type: "ack", payload: null};
    const result = processor.process(ackMessage, "opening", 0);
    expect(result.newState).toBe("open");
    expect(result.newLocalAck).toBe(1);
    expect(result.actions).toEqual([
      {type: "emit", event: "ack", payload: null},
      {type: "emit", event: "open"},
    ]);
  });

  it("should process a 'data' message correctly", () => {
    const processor = new MessageProcessor<any>("initiator");
    const dataMessage: FsDuplexMessage = {
      from: "handler",
      seq: 2,
      ack: 1,
      type: "data",
      payload: {message: "ping"},
    };
    const result = processor.process(dataMessage, "open", 1);
    expect(result.newState).toBe("open"); // State should not change
    expect(result.newLocalAck).toBe(2);
    expect(result.actions).toEqual([{type: "emit", event: "data", payload: {message: "ping"}}]);
  });

  it("should ignore old messages based on seq number", () => {
    const processor = new MessageProcessor<any>("handler");
    const oldMessage: FsDuplexMessage = {from: "initiator", seq: 5, ack: 0, type: "init", payload: {}};
    const result = processor.process(oldMessage, "open", 5);
    expect(result.newState).toBe("open");
    expect(result.newLocalAck).toBe(5);
    expect(result.actions).toEqual([]);
  });

  it("should handle passive close correctly", () => {
    const processor = new MessageProcessor<any>("handler");
    const finMessage: FsDuplexMessage = {from: "initiator", seq: 2, ack: 1, type: "fin", payload: {reason: "done"}};
    const result = processor.process(finMessage, "open", 1);
    expect(result.newState).toBe("closed");
    expect(result.newLocalAck).toBe(2);
    expect(result.actions).toEqual([
      {type: "emit", event: "fin", payload: {reason: "done"}},
      {type: "send", messageType: "fin_ack", payload: null},
      {type: "emit", event: "close"},
    ]);
  });

  it("should handle acknowledging a close message", () => {
    const processor = new MessageProcessor<any>("initiator");
    const finAckMessage: FsDuplexMessage = {from: "handler", seq: 2, ack: 2, type: "fin_ack", payload: null};
    const result = processor.process(finAckMessage, "closing", 1);
    expect(result.newState).toBe("closed");
    expect(result.newLocalAck).toBe(2);
    expect(result.actions).toEqual([
      {type: "emit", event: "fin_ack", payload: null},
      {type: "emit", event: "close"},
    ]);
  });

  it("should ignore 'data' messages when in 'opening' state", () => {
    const processor = new MessageProcessor<any>("handler");
    const dataMessage: FsDuplexMessage = {
      from: "initiator",
      seq: 1,
      ack: 0,
      type: "data",
      payload: {message: "ping"},
    };
    const result = processor.process(dataMessage, "opening", 0);
    // State should not change, and no actions other than the initial emit should be generated.
    expect(result.newState).toBe("opening");
    expect(result.newLocalAck).toBe(1);
    expect(result.actions).toEqual([{type: "emit", event: "data", payload: {message: "ping"}}]);
  });

  it("should ignore 'init' messages when in 'open' state", () => {
    const processor = new MessageProcessor<any>("handler");
    const initMessage: FsDuplexMessage = {from: "initiator", seq: 10, ack: 9, type: "init", payload: {}};
    const result = processor.process(initMessage, "open", 9);
    // State should not change.
    expect(result.newState).toBe("open");
    expect(result.newLocalAck).toBe(10);
    expect(result.actions).toEqual([{type: "emit", event: "init", payload: {}}]);
  });

  it("should ignore any message from self", () => {
    const processor = new MessageProcessor<any>("initiator");
    const selfMessage: FsDuplexMessage = {from: "initiator", seq: 1, ack: 0, type: "init", payload: {}};
    const result = processor.process(selfMessage, "opening", 0);
    // No state change, no actions.
    expect(result.newState).toBe("opening");
    expect(result.newLocalAck).toBe(0);
    expect(result.actions).toEqual([]);
  });
});
