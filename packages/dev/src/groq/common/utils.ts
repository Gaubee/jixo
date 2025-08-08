import type {FsDuplex} from "../fs-duplex/common.js";

export class DuplexClosedError extends Error {
  constructor(reason: string) {
    super(`The duplex channel was closed unexpectedly. Reason: ${reason}`);
    this.name = "DuplexClosedError";
  }
}

export class WaitTimeoutError extends Error {
  constructor(timeout: number) {
    super(`Waited for next task for ${timeout}ms, but no data was received.`);
    this.name = "WaitTimeoutError";
  }
}

interface WaitOptions<T> {
  /**
   * Timeout in milliseconds. If the promise is not resolved within this time, it will be rejected.
   */
  timeout?: number;
  /**
   * An optional filter function to apply to the data. The promise will only resolve if the data passes this filter.
   */
  filter?: (data: T) => boolean;
}

/**
 * Waits for the next data event from an FsDuplex instance, with built-in safeguards.
 * This is a core utility for creating linear, async/await-based protocol handlers.
 *
 * @param duplex The FsDuplex instance to listen on.
 * @param options Optional configuration for timeout and filtering.
 * @returns A promise that resolves with the next data payload.
 * @rejects {DuplexClosedError} If the duplex channel closes while waiting.
 * @rejects {WaitTimeoutError} If the timeout is reached before data is received.
 */
export function waitNextTask<T>(duplex: FsDuplex<T, any>, options: WaitOptions<T> = {}): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let timeoutId: NodeJS.Timeout | undefined;

    const cleanup = () => {
      if (timeoutId) clearTimeout(timeoutId);
      // Remove the listeners we attached to avoid memory leaks
      offData();
      offClose();
    };

    const offData = duplex.onData.on((data) => {
      if (!options.filter || options.filter(data)) {
        cleanup();
        resolve(data);
      }
    });

    const offClose = duplex.onClose.on((reason) => {
      cleanup();
      reject(new DuplexClosedError(reason));
    });

    if (options.timeout) {
      timeoutId = setTimeout(() => {
        cleanup();
        reject(new WaitTimeoutError(options.timeout!));
      }, options.timeout);
    }
  });
}
