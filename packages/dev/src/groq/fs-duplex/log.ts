import fsp from "node:fs/promises";
import type {FsDuplexBrowserHelper} from "./browser.js";

/**
 * Interface for a low-level, append-only log handler.
 * It is responsible for raw file I/O.
 */
export interface AppendOnlyLog {
  start(): Promise<void>;
  stop(): Promise<void>;
  append(line: string): Promise<void>;
  readNewLines(): Promise<string[]>;
}

/**
 * Node.js implementation of AppendOnlyLog.
 */
export class NodeAppendOnlyLog implements AppendOnlyLog {
  private filepath: string;
  private readOffset = 0;
  private fileHandle: fsp.FileHandle | null = null;
  private lineBuffer = "";

  constructor(filepath: string) {
    this.filepath = filepath;
  }

  public async start(): Promise<void> {
    if (this.fileHandle) return;
    this.fileHandle = await fsp.open(this.filepath, "a+");
  }

  public async stop(): Promise<void> {
    if (this.fileHandle) {
      await this.fileHandle.close();
      this.fileHandle = null;
    }
    this.readOffset = 0;
    this.lineBuffer = "";
  }

  public async append(line: string): Promise<void> {
    await fsp.appendFile(this.filepath, line + "\n", "utf-8");
  }

  public async readNewLines(): Promise<string[]> {
    if (!this.fileHandle) {
      throw new Error("Log is not started. Call start() before reading.");
    }

    const stats = await this.fileHandle.stat();
    const newBytes = stats.size - this.readOffset;

    if (newBytes <= 0) {
      return [];
    }

    const buffer = Buffer.alloc(newBytes);
    await this.fileHandle.read(buffer, 0, newBytes, this.readOffset);
    this.readOffset = stats.size;

    this.lineBuffer += buffer.toString("utf-8");
    const lines = this.lineBuffer.split("\n");

    if (this.lineBuffer[this.lineBuffer.length - 1] !== "\n") {
      this.lineBuffer = lines.pop() || "";
    } else {
      this.lineBuffer = "";
      lines.pop();
    }

    return lines;
  }
}

/**
 * Browser implementation of AppendOnlyLog.
 */
export class BrowserAppendOnlyLog implements AppendOnlyLog {
  private filename: string;
  private helper: FsDuplexBrowserHelper;
  private readOffset = 0;
  private lineBuffer = "";

  constructor(filename: string, helper: FsDuplexBrowserHelper) {
    this.filename = filename;
    this.helper = helper;
  }

  public async start(): Promise<void> {
    // In the browser, the file handle is ephemeral, so start is a no-op.
    // We just ensure the file exists on first write.
    return Promise.resolve();
  }

  public async stop(): Promise<void> {
    // Nothing to do here for the browser implementation.
    this.readOffset = 0;
    this.lineBuffer = "";
    return Promise.resolve();
  }

  public async append(line: string): Promise<void> {
    const handle = await this.helper.getFileHandle(this.filename);
    const file = await handle.getFile();
    const writer = await handle.createWritable({keepExistingData: true});
    await writer.seek(file.size);
    await writer.write(line + "\n");
    await writer.close();
  }

  public async readNewLines(): Promise<string[]> {
    try {
      const handle = await this.helper.getFileHandle(this.filename);
      const file = await handle.getFile();

      if (file.size <= this.readOffset) {
        return [];
      }

      const newContent = await file.slice(this.readOffset).text();
      this.readOffset = file.size;

      this.lineBuffer += newContent;
      const lines = this.lineBuffer.split("\n");

      if (this.lineBuffer[this.lineBuffer.length - 1] !== "\n") {
        this.lineBuffer = lines.pop() || "";
      } else {
        this.lineBuffer = "";
        lines.pop();
      }

      return lines;
    } catch (e: any) {
      if (e.name === "NotFoundError") {
        return [];
      }
      throw e;
    }
  }
}
