import type {SuperJSON} from "superjson";
import type {EasyFS} from "../../google-aistudio/browser/utils.js";
import {FsDuplex} from "../common/fs-duplex.js";
import type {Task} from "../common/types.js";

/**
 * Browser implementation of FsDuplex.
 * It uses a provided `EasyFS` instance to interact with the sandboxed filesystem
 * and `requestIdleCallback` for efficient, non-blocking polling.
 */
export class BrowserFsDuplex<T extends Task> extends FsDuplex<T> {
  private _lastContent: string | undefined;
  private _isDestroyed = false;
  private _idleCallbackId: number | null = null;

  constructor(
    superjson: SuperJSON,
    private _fs: EasyFS,
    private _filename: string,
  ) {
    super(superjson);
  }

  get filename() {
    return this._filename;
  }
  /**
   * Starts the polling mechanism using requestIdleCallback.
   */
  public start(): void {
    this._poll();
  }

  private _poll() {
    if (this._isDestroyed) return;

    this._idleCallbackId = requestIdleCallback(async () => {
      try {
        const content = await this._fs.readFileText(this._filename);
        if (content && content !== this._lastContent) {
          this._lastContent = content;
          const task: T = this.superjson.parse(content);
          this._onData(task);
        }
      } catch (error) {
        // readFileText will throw if file not found, signaling a close.
        this._onClose();
        return; // Stop polling
      }

      // Continue the loop
      this._poll();
    });
  }

  /**
   * Writes data to the task file in the browser's filesystem.
   * @param payload A partial task object to be merged and written.
   */
  public async write(payload: Partial<T>): Promise<void> {
    if (this._isDestroyed) {
      throw new Error("Cannot write to a destroyed FsDuplex.");
    }
    const updatedData = Object.assign({}, this._currentData, payload);
    const content = this.superjson.stringify(updatedData);

    this._currentData = updatedData;
    this._lastContent = content;

    await this._fs.writeFile(this._filename, content);
  }

  /**
   * Destroys the duplex channel, stops polling, and deletes the task file.
   */
  public async destroy(): Promise<void> {
    if (this._isDestroyed) return;
    this._isDestroyed = true;

    if (this._idleCallbackId) {
      cancelIdleCallback(this._idleCallbackId);
      this._idleCallbackId = null;
    }
    this._onClose();
    await this._fs.rm(this._filename).catch(() => {});
  }
}
