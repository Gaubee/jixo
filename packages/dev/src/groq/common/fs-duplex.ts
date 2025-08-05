import type {SuperJSON} from "superjson";

type Events = "open" | "data" | "close";
type Listener<T> = (data: T) => void;

/**
 * FsDuplex (Filesystem Duplex)
 *
 * An abstract class that provides a standardized, duplex (two-way) communication channel
 * over a file-based system. It abstracts away the underlying filesystem implementation
 * (e.g., Node.js `fs` vs. a browser-based filesystem shim) and offers a consistent,
 * event-driven, and streamable interface.
 *
 * It is designed to manage the lifecycle of a single task file.
 *
 * @template T The type of the data object being exchanged (e.g., a `Task`).
 */
export abstract class FsDuplex<T> {
  protected _currentData: T | undefined;
  protected _isClosed = false;
  private _events: Record<Events, Set<Listener<T>>> = {
    open: new Set(),
    data: new Set(),
    close: new Set(),
  };

  private _resolveNextData!: (value: T) => void;
  private _nextDataPromise: Promise<T>;

  private _resolveClosed!: () => void;
  private _closedPromise: Promise<void>;

  /**
   * @param superjson The SuperJSON instance for serialization/deserialization.
   */
  constructor(protected superjson: SuperJSON) {
    this._nextDataPromise = new Promise((resolve) => {
      this._resolveNextData = resolve;
    });
    this._closedPromise = new Promise((resolve) => {
      this._resolveClosed = resolve;
    });
  }

  /**
   * Subscribes to an event.
   * @param event The event name ('open', 'data', 'close').
   * @param listener The callback function.
   * @returns A function to unsubscribe.
   */
  public on(event: Events, listener: Listener<T>): () => void {
    this._events[event].add(listener);
    return () => this._events[event].delete(listener);
  }

  /**
   * Emits an event to all subscribed listeners.
   * @param event The event name.
   * @param data The data to pass to listeners.
   */
  protected _emit(event: Events, data: T) {
    this._events[event].forEach((listener) => listener(data));
  }

  /**
   * Handles the reception of new data, updating state and notifying listeners.
   * This method is intended to be called by subclasses when they detect a file change.
   * @param data The new data object.
   */
  protected _onData(data: T) {
    const isFirstData = this._currentData === undefined;
    this._currentData = data;

    if (isFirstData) {
      this._emit("open", data);
    }
    this._emit("data", data);

    // Resolve promises for awaiters
    this._resolveNextData(data);
    this._nextDataPromise = new Promise((resolve) => {
      this._resolveNextData = resolve;
    });
  }

  /**
   * Handles the closing of the channel, notifying listeners.
   * This method is intended to be called by subclasses when they detect file deletion.
   */
  protected _onClose() {
    if (this._isClosed) return;
    this._isClosed = true;
    if (this._currentData) {
      this._emit("close", this._currentData);
    }
    this._resolveClosed();
  }

  /**
   * Returns the most recently received data object.
   * @returns The current data, or undefined if none has been received.
   */
  public data(): T | undefined {
    return this._currentData;
  }

  /**
   * Returns a promise that resolves with the next data object received.
   */
  public async nextData(): Promise<T> {
    return this._nextDataPromise;
  }

  /**
   * Returns a promise that resolves when the communication channel is closed.
   */
  public get closed(): Promise<void> {
    return this._closedPromise;
  }

  /**
   * Provides an async generator to iterate over incoming data objects.
   * The loop terminates when the channel is closed.
   */
  public async *stream(): AsyncGenerator<T, void, void> {
    while (!this._isClosed) {
      const data = await Promise.race([this.nextData(), this.closed]);
      if (this._isClosed || data === undefined) {
        break;
      }
      yield data as T;
    }
  }

  /**
   * Abstract method to be implemented by subclasses.
   * This should contain the logic to start listening for file changes.
   */
  abstract start(): void;

  /**
   * Abstract method to write data to the filesystem.
   * @param payload The partial data to merge and write.
   */
  abstract write(payload: Partial<T>): Promise<void>;

  /**
   * Abstract method to signal the end of communication and clean up resources.
   */
  abstract destroy(): Promise<void>;
}
