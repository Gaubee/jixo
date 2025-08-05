import {readFile, rm, stat, writeFile} from "node:fs/promises";
import type {SuperJSON} from "superjson";
import {FsDuplex} from "../common/fs-duplex.js";
import {debug} from "./utils.js";

/**
 * Node.js implementation of FsDuplex.
 */
export class NodeFsDuplex<T extends {closed?: boolean}> extends FsDuplex<T> {
  private _lastMtime = 0;
  private _taskFilepath: string;
  private _pollTimeoutId: NodeJS.Timeout | null = null;
  private _isDestroyed = false;
  private _id: string; // For logging
  private _enoentCount = 0; // Error tolerance counter
  private static readonly MAX_ENOENT_RETRIES = 5; // Allow for up to 250ms of file disappearance

  private constructor(
    superjson: SuperJSON,
    private _filepath: string,
    id: string,
  ) {
    super(superjson);
    this._taskFilepath = _filepath;
    this._id = `FsDuplex-${id}`;
  }

  public static async create<T extends {closed?: boolean}>(superjson: SuperJSON, filepath: string, id: string, initialTask?: T): Promise<NodeFsDuplex<T>> {
    const duplex = new NodeFsDuplex<T>(superjson, filepath, id);
    if (initialTask) {
      duplex._currentData = initialTask;
      debug(duplex._id, "CONSTRUCT_WITH_INITIAL_TASK", initialTask);
      await duplex.write({});
    } else {
      debug(duplex._id, "CONSTRUCT_EMPTY");
    }
    return duplex;
  }

  public start(): void {
    debug(this._id, "START_POLLING");
    this._poll();
  }

  protected _onData(data: T) {
    super._onData(data);
    // New close protocol: if the data itself says it's closed, we close.
    if (data.closed) {
      debug(this._id, "_onData: Received closed:true flag. Closing channel.");
      this._onClose();
    }
  }

  private async _poll() {
    if (this._isDestroyed) {
      debug(this._id, "_poll: DESTROYED, skipping poll");
      return;
    }

    try {
      const stats = await stat(this._taskFilepath);
      this._enoentCount = 0; // Reset counter on success
      if (stats.mtimeMs > this._lastMtime) {
        debug(this._id, `_poll: DETECT_CHANGE (mtime: ${stats.mtimeMs} > ${this._lastMtime})`);
        this._lastMtime = stats.mtimeMs;
        const content = await readFile(this._taskFilepath, "utf-8");
        if (content) {
          const task: T = this.superjson.parse(content);
          debug(this._id, `_poll: PARSED_DATA`, task);
          this._onData(task);
        }
      }
    } catch (error: any) {
      if (error.code === "ENOENT") {
        // FIX: Implement error tolerance for ENOENT
        this._enoentCount++;
        debug(this._id, `_poll: FILE_NOT_FOUND (count: ${this._enoentCount}), will retry.`);
        if (this._enoentCount >= NodeFsDuplex.MAX_ENOENT_RETRIES) {
          debug(this._id, `_poll: MAX_ENOENT_RETRIES exceeded. Closing channel as an exception.`);
          this._onClose(); // Close only after multiple consecutive failures
          return;
        }
      } else {
        debug(this._id, `_poll: ERROR`, error);
      }
    }

    // Schedule the next poll unless we've decided to close.
    if (!this._isClosed) {
      this._pollTimeoutId = setTimeout(() => this._poll(), 50);
    }
  }

  public async write(payload: Partial<T>): Promise<void> {
    if (this._isDestroyed) {
      // Allow writing the final "closed" message even if locally destroyed
      if (!payload.closed) {
        throw new Error("Cannot write to a destroyed FsDuplex.");
      }
    }

    const updatedData = Object.assign({}, this._currentData, payload);
    this._currentData = updatedData;
    debug(this._id, `WRITE`, updatedData);

    try {
      await writeFile(this._taskFilepath, this.superjson.stringify(updatedData));
      const stats = await stat(this._taskFilepath);
      debug(this._id, `WRITE_COMPLETE (new mtime: ${stats.mtimeMs})`);
      this._lastMtime = stats.mtimeMs;
    } catch (writeError) {
      debug(this._id, `WRITE FAILED`, writeError);
    }
  }

  public async destroy(): Promise<void> {
    if (this._isDestroyed) return;
    this._isDestroyed = true; // Mark as locally destroyed to stop further actions
    debug(this._id, "DESTROY: Sending closed:true signal.");

    if (this._pollTimeoutId) {
      clearTimeout(this._pollTimeoutId);
      this._pollTimeoutId = null;
    }

    // New protocol: write a final message to signal closure.
    await this.write({closed: true} as Partial<T>);

    // The remote side will call _onClose() upon receiving this message.
    // We also call it locally to terminate any pending promises.
    this._onClose();

    // The file is a temporary artifact. We can schedule its deletion.
    // The initiator is typically the one responsible for final cleanup.
    setTimeout(() => {
      debug(this._id, "Performing delayed physical file deletion.");
      rm(this._taskFilepath, {force: true}).catch(() => {});
    }, 2000); // Delay to ensure the other side has time to read the final state
  }
}
