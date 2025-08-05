import {z} from "zod/v4";

export type FsDuplexParty = "initiator" | "handler";

/**
 * The Zod schema for a raw message on the wire.
 * It validates the core fields of the protocol frame.
 * The 'payload' is treated as `any` here and will be typed by consuming code.
 */
export const zFsDuplexMessage = z.object({
  from: z.enum(["initiator", "handler"]),
  seq: z.number().int().positive(),
  ack: z.number().int().nonnegative(),
  type: z.string(),
  payload: z.any().optional(),
});
export type FsDuplexMessage = z.infer<typeof zFsDuplexMessage>;

/**
 * Defines the payloads for all possible message types in the fs-duplex protocol.
 * The generic type <T> represents the application-specific data being transported.
 */
export type FsDuplexPayloads<T> = {
  // --- Control Messages ---
  // These manage the lifecycle of the communication channel.
  init: {initial_payload?: T};
  ack: null;
  fin: {reason: "done" | "error" | "timeout"};
  fin_ack: null;
  ping: null;
  pong: null;

  // --- Data Message ---
  // This transports the application-specific data payload,
  // treated as opaque by the protocol itself.
  data: T;
};

/**
 * The union of all possible message types.
 */
export type FsDuplexMessageType = keyof FsDuplexPayloads<any>;
