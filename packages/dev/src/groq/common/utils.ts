import type {FsDuplex} from "./fs-duplex/common.js";

/**
 * A custom error class to signify that a task was aborted due to the duplex closing.
 */
export class TaskError extends Error {
  public readonly reason: string;
  constructor(reason: string) {
    super(`Task aborted. Reason: ${reason}`);
    this.name = "TaskError";
    this.reason = reason;
  }
}

/**
 * Waits for the next data event from the FsDuplex instance, racing against the onClose event.
 * This utility transforms the event-driven nature of FsDuplex into a linear, await-based flow.
 *
 * @param duplex The FsDuplex instance to listen on.
 * @returns A promise that resolves with the next data payload.
 * @throws {TaskError} If the duplex channel closes before the next data event is received.
 */
export function waitNextTask<T>(duplex: FsDuplex<T, any>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const onData = (data: T) => {
      cleanup();
      resolve(data);
    };

    const onClose = (reason: string) => {
      cleanup();
      reject(new TaskError(reason));
    };

    const cleanup = () => {
      duplex.onData.off(onData);
      duplex.onClose.off(onClose);
    };

    duplex.onData.on(onData);
    duplex.onClose.on(onClose);
  });
}
