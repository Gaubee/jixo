import Debug from "debug";
import fsp from "node:fs/promises";
import type {FsDuplexBrowserHelper} from "./browser.js";

const nodeLog = Debug("jixo:fs-duplex:node-log");
const browserLog = Debug("jixo:fs-duplex:browser-log");

export interface AppendOnlyLog {
  start(): Promise<void>;
  stop(): Promise<void>;
  append(line: string): Promise<void>;
  readNewLines(): Promise<string[]>;
}

export class NodeAppendOnlyLog implements AppendOnlyLog {
  private filepath: string;
  private readOffset = 0;
  private lineBuffer = "";

  constructor(filepath: string) {
    this.filepath = filepath;
    nodeLog("Constructed for file: %s", this.filepath);
  }

  public async start(): Promise<void> {
    // Ensure the file exists so we don't error on first read attempt.
    await fsp.appendFile(this.filepath, "", "utf-8");
  }

  public async stop(): Promise<void> {
    this.readOffset = 0;
    this.lineBuffer = "";
  }

  public async append(line: string): Promise<void> {
    await fsp.appendFile(this.filepath, line + "\n", "utf-8");
  }

  public async readNewLines(): Promise<string[]> {
    let fileHandle: fsp.FileHandle | undefined;
    try {
      const stats = await fsp.stat(this.filepath);

      if (stats.size < this.readOffset) {
        nodeLog("File swap detected for %s. Resetting read offset.", this.filepath);
        this.readOffset = 0;
        this.lineBuffer = "";
      }

      const newBytes = stats.size - this.readOffset;
      if (newBytes <= 0) {
        return [];
      }

      fileHandle = await fsp.open(this.filepath, "r");
      const buffer = Buffer.alloc(newBytes);
      await fileHandle.read(buffer, 0, newBytes, this.readOffset);

      nodeLog("Read %d new bytes from %s", newBytes, this.filepath);
      this.readOffset += newBytes;
      this.lineBuffer += buffer.toString("utf-8");

      const lines = this.lineBuffer.split("\n");

      if (this.lineBuffer.at(-1) !== "\n") {
        this.lineBuffer = lines.pop() || "";
      } else {
        this.lineBuffer = "";
        lines.pop();
      }

      return lines.filter((line) => line);
    } catch (error: any) {
      if (error.code === "ENOENT") {
        return [];
      }
      nodeLog("Error reading file %s: %O", this.filepath, error);
      return [];
    } finally {
      await fileHandle?.close();
    }
  }
}

export class BrowserAppendOnlyLog implements AppendOnlyLog {
  private filename: string;
  private helper: FsDuplexBrowserHelper;
  private readOffset = 0;
  private lineBuffer = "";

  constructor(filename: string, helper: FsDuplexBrowserHelper) {
    this.filename = filename;
    this.helper = helper;
    browserLog("Constructed for file: %s", this.filename);
  }

  public async start(): Promise<void> {
    return Promise.resolve();
  }

  public async stop(): Promise<void> {
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

      const slice = file.slice(this.readOffset);
      const newContent = await slice.text();

      if (newContent.length === 0) {
        return [];
      }

      browserLog("Detected %d new chars in %s", newContent.length, this.filename);
      this.readOffset += slice.size;
      this.lineBuffer += newContent;
      const lines = this.lineBuffer.split("\n");

      if (this.lineBuffer.at(-1) !== "\n") {
        this.lineBuffer = lines.pop() || "";
      } else {
        this.lineBuffer = "";
        lines.pop();
      }

      return lines.filter((line) => line);
    } catch (e: any) {
      if (e.name === "NotFoundError") return [];
      browserLog("Error reading file %s: %O", this.filename, e);
      throw e;
    }
  }
}
