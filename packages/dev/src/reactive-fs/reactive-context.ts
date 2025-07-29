import {abort_signal_race} from "@gaubee/util";
import Debug from "debug";
import {AsyncLocalStorage} from "node:async_hooks";

const debug = Debug("jixo:reactive-fs-v2");
// The context now only needs to know about the active context instance.
const contextStorage = new AsyncLocalStorage<ReactiveContext>();

export interface ReactiveStateOptions<T> {
  equals?: (a: T, b: T) => boolean;
}

/**
 * Represents a single piece of reactive state that can be tracked by a ReactiveContext.
 * It's analogous to Signal.State.
 */
export class ReactiveState<T> {
  private currentValue: T;
  private readonly equals: (a: T, b: T) => boolean;

  constructor(initialValue: T, options?: ReactiveStateOptions<T>) {
    this.currentValue = initialValue;
    this.equals = options?.equals ?? ((a, b) => a === b);
  }

  /**
   * Retrieves the current value of the state.
   * If called within a ReactiveContext task, it enables tracking.
   * @returns The current value.
   */
  public get(): T {
    const context = contextStorage.getStore();

    // It can be called outside a context, it just won't be reactive.
    // This can be useful for initial setup or non-reactive reads.
    if (context) {
      return context.getOrPushCache(this, this.currentValue);
    }

    return this.currentValue;
  }

  /**
   * Updates the value of the state.
   * If the new value is different from the old one, it notifies any active
   * ReactiveContext that it has become dirty.
   * @param newValue The new value.
   */
  public set(newValue: T): boolean {
    if (this.equals(this.currentValue, newValue)) {
      return false;
    }

    this.currentValue = newValue;
    const context = contextStorage.getStore();
    context?.notifyChange();
    return true;
  }
}

/**
 * Manages the execution of an asynchronous, reactive task.
 * It now works by tracking changes on ReactiveState instances used within its task.
 */
export class ReactiveContext {
  private isRunning = false;
  private hasChanged?: PromiseWithResolvers<void>;
  private caches = new Map<ReactiveState<any>, any>();
  private readonly task: () => Promise<void>;
  constructor(
    task: () => Promise<void>,
    readonly watch = false,
  ) {
    if (typeof task !== "function") throw new TypeError("Task must be a function.");
    this.task = task;
  }
  /** @internal */
  getOrPushCache<T>(state: ReactiveState<T>, value: T): T {
    if (this.caches.has(state)) return this.caches.get(state);
    this.caches.set(state, value);
    return value;
  }

  /** @internal */
  notifyChange(): void {
    debug("notifyChange", this.hasChanged);
    // If a state changes, we mark the whole context as dirty.
    this.hasChanged?.resolve();
  }

  /**
   * TODO 实现off
   * @param watch
   * @returns
   */
  public async run({signal}: ReactiveContextRunOptions = {}): Promise<void> {
    if (this.isRunning) {
      console.warn("ReactiveContext.run() called while already running. Ignoring call.");
      return;
    }
    this.isRunning = true;
    try {
      if (this.watch) {
        while (!signal?.aborted) {
          const hasChanged = (this.hasChanged = Promise.withResolvers());
          this.caches.clear();
          const runOnce = async () => {
            // The context provides itself to the async storage.
            await contextStorage.run(this, this.task);
            /// wait changed
            await hasChanged.promise;
          };

          /// wait changed
          await (signal ? abort_signal_race(signal, runOnce) : runOnce());
        }
      } else {
        await contextStorage.run(this, this.task);
      }
    } finally {
      this.hasChanged?.reject(new Error("Context ended"));
      this.hasChanged = undefined;
      this.isRunning = false;
    }
  }
}
export interface ReactiveContextRunOptions {
  signal?: AbortSignal;
}
