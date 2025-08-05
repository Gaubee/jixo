import {readFile, rm, stat, writeFile} from "node:fs/promises";
import type {SuperJSON} from "superjson";
import {FsDuplex} from "../common/fs-duplex.js";
import type {Task} from "../common/types.js";

/**
 * Node.js implementation of FsDuplex.
 * It uses `fs/promises` to interact with the local filesystem and a polling
 * mechanism with `setTimeout` to watch for file changes.
 */
export class NodeFsDuplex<T > extends FsDuplex<T> {
  private _lastMtime = 0;
  private _taskFilepath: string;
  private _pollTimeoutId: NodeJS.Timeout | null = null;
  private _isDestroyed = false;

  constructor(
    superjson: SuperJSON,
    private _filepath: string,
    initialTask?: T,
  ) {
    super(superjson);
    this._taskFilepath = _filepath;
    if (initialTask) {
      this._currentData = initialTask;
      // Immediately write the initial task to the file
      this.write({}).catch((err) => console.error("Failed to write initial task:", err));
    }
  }

  /**
   * Starts the polling mechanism to watch for file changes.
   */
  public start(): void {
    this._poll();
  }

  private async _poll() {
    if (this._isDestroyed) return;

    try {
      const stats = await stat(this._taskFilepath);
      if (stats.mtimeMs > this._lastMtime) {
        this._lastMtime = stats.mtimeMs;
        const content = await readFile(this._taskFilepath, "utf-8");
        if (content) {
          const task: T = this.superjson.parse(content);
          this._onData(task);
        }
      }
    } catch (error: any) {
      if (error.code === "ENOENT") {
        // File not found, which we treat as the channel being closed.
        this._onClose();
        return; // Stop polling
      }
      // Ignore other errors like SyntaxError from partial writes
    }

    // Schedule the next poll
    this._pollTimeoutId = setTimeout(() => this._poll(), 50);
  }

  /**
   * Writes data to the task file. It merges the payload with the current data.
   * @param payload A partial task object to be merged and written.
   */
  public async write(payload: Partial<T>): Promise<void> {
    if (this._isDestroyed) {
      throw new Error("Cannot write to a destroyed FsDuplex.");
    }

    // Merge payload into current data
    const updatedData = Object.assign({}, this._currentData, payload);
    this._currentData = updatedData;

    await writeFile(this._taskFilepath, this.superjson.stringify(updatedData));
    // After writing, update the mtime to avoid re-reading our own write
    const stats = await stat(this._taskFilepath);
    this._lastMtime = stats.mtimeMs;
  }

  /**
   * Destroys the duplex channel, stops polling, and deletes the task file.
   */
  public async destroy(): Promise<void> {
    if (this._isDestroyed) return;
    this._isDestroyed = true;

    if (this._pollTimeoutId) {
      clearTimeout(this._pollTimeoutId);
      this._pollTimeoutId = null;
    }

    this._onClose();

    // Schedule the file for deletion after a short delay to ensure
    // the other party has acknowledged the final state.
    setTimeout(() => {
      rm(this._taskFilepath, {force: true}).catch(() => {
        // Ignore errors, file might already be gone
      });
    }, 10_000);
  }
}
