import fsp from "node:fs/promises";
import type {FsDuplexBrowserHelper} from "./browser.js";

/**
 * Reads the heartbeat file in Node.js to check for liveness.
 */
export class NodeHeartbeatReader {
  private filepath: string;

  constructor(filepath: string) {
    this.filepath = filepath;
  }

  /**
   * Checks if the heartbeat timestamp is recent.
   * @param timeout The maximum allowed age of the heartbeat in milliseconds.
   * @returns True if the peer is considered alive, false otherwise.
   */
  public async isAlive(timeout: number): Promise<boolean> {
    try {
      const content = await fsp.readFile(this.filepath, "utf-8");
      const timestamp = parseInt(content, 10);
      if (isNaN(timestamp)) {
        return false; // Corrupted content
      }
      return Date.now() - timestamp < timeout;
    } catch (error: any) {
      if (error.code === "ENOENT") {
        return false; // File doesn't exist yet or was cleaned up
      }
      // Re-throw other unexpected errors
      throw error;
    }
  }
}

/**
 * Writes the heartbeat file periodically in the Browser.
 */
export class BrowserHeartbeatWriter {
  private filename: string;
  private helper: FsDuplexBrowserHelper;
  private interval: number;
  private timer: NodeJS.Timeout | null = null;

  constructor(filename: string, helper: FsDuplexBrowserHelper, interval = 2000) {
    this.filename = filename;
    this.helper = helper;
    this.interval = interval;
  }

  /**
   * Starts the periodic writing of the heartbeat file.
   */
  public start(): void {
    if (this.timer) return;
    // Write immediately on start, then set interval
    this._writeHeartbeat();
    this.timer = setInterval(() => this._writeHeartbeat(), this.interval);
  }

  /**
   * Stops writing the heartbeat.
   */
  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async _writeHeartbeat(): Promise<void> {
    try {
      const handle = await this.helper.getFileHandle(this.filename);
      const writer = await handle.createWritable(); // Overwrite is fine for heartbeat
      await writer.write(String(Date.now()));
      await writer.close();
    } catch (error) {
      console.error("Failed to write heartbeat:", error);
      // We don't stop the timer, it will retry on the next interval.
    }
  }
}
