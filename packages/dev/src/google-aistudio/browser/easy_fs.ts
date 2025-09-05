import {func_catch, func_remember} from "@gaubee/util";
import {delay, prepareDirHandle} from "./utils.js";
export const getEasyFs = func_remember(async () => {
  const [error, dirHandle] = await func_catch(prepareDirHandle)();
  if (!dirHandle) {
    getEasyFs.reset();
    throw error;
  }

  /* ---------- helpers ---------- */
  interface GetHandleOptions {
    create?: boolean;
  }
  const getHandle = async (path: string, {create = false}: GetHandleOptions = {}) => {
    let curr: FileSystemDirectoryHandle = dirHandle;
    const parts = path.split("/").filter(Boolean);
    const last = parts.at(-1);

    for (let i = 0; i < parts.length - 1; i++) {
      curr = await curr.getDirectoryHandle(parts[i], {create});
    }

    return {
      parent: curr,
      name: last,
      async getFile() {
        if (!last) {
          throw new Error("No file name");
        }
        return curr.getFileHandle(last, {create});
      },
      async getDir() {
        if (!last) {
          return curr;
        }
        return curr.getDirectoryHandle(last, {create});
      },
    };
  };

  /* ---------- public API ---------- */

  const writeFile = async (filePath: string, data: FileSystemWriteChunkType, opts?: {append?: boolean}) => {
    const {getFile} = await getHandle(filePath, {create: true});
    const handle = await getFile();
    const w = await handle.createWritable();
    if (!opts?.append) await w.truncate(0);
    await w.write(data);
    await w.close();
  };

  const createWriteStream = async (filePath: string) => {
    const {getFile} = await getHandle(filePath, {create: true});
    const handle = await getFile();
    return handle.createWritable();
  };

  const readFileText = async (filePath: string) => {
    const {getFile} = await getHandle(filePath);
    const file = await (await getFile()).getFile();
    return file.text();
  };

  const readFileBinary = async (filePath: string) => {
    const {getFile} = await getHandle(filePath);
    const file = await (await getFile()).getFile();
    return file.bytes();
  };

  const createReadStream = async (filePath: string) => {
    const {getFile} = await getHandle(filePath);
    const file = await (await getFile()).getFile();
    return file.stream();
  };

  const readdir = async (dirPath: string) => {
    const {getDir} = await getHandle(dirPath);
    const dir = await getDir();
    return Array.fromAsync(dir.keys());
  };

  const mkdir = async (dirPath: string, opts?: {recursive?: boolean}) => {
    const parts = dirPath.split("/").filter(Boolean);
    let curr: FileSystemDirectoryHandle = dirHandle;

    for (const segment of parts) {
      curr = await curr.getDirectoryHandle(segment, {create: true});
      if (!opts?.recursive) break;
    }
  };

  const exists = async (path: string) => {
    try {
      await getHandle(path);
      return true;
    } catch {
      return false;
    }
  };

  const stat = async (path: string) => {
    const {getFile, getDir} = await getHandle(path);
    try {
      const h = await getFile();
      const f = await h.getFile();
      return {isFile: true, size: f.size, lastModified: f.lastModified} as const;
    } catch {
      await getDir();
      return {isFile: false} as const;
    }
  };

  const rm = async (path: string, opts?: {recursive?: boolean}) => {
    try {
      const {parent, name} = await getHandle(path);
      if (!name) {
        throw new Error("Invalid path");
      }
      await parent.removeEntry(name, {recursive: opts?.recursive});
      return true;
    } catch {
      return false;
    }
  };

  return {
    writeFile,
    createWriteStream,
    readFileText,
    readFileBinary,
    createReadStream,
    readdir,
    mkdir,
    exists,
    stat,
    rm,
  };
});
export type EasyFS = Awaited<ReturnType<typeof getEasyFs>>;

// --- New Responsive Utilities ---

/** `null` 代表文件不存在 */
export type Snapshot = {mtime: number; size: number} | null;

export type FileChangeEvent = {event: "init" | "add" | "modify" | "delete"; newSnap: Snapshot};

/**
 * 创建一个一次性的、有状态的文件变更监听器。
 * 它会异步地等待，直到文件的状态发生变化，然后解析并结束。
 * 它返回一个包含 promise 和 dispose 函数的对象，用于手动取消。
 *
 * @param filePath 要监听的文件路径。
 * @param currentSnap 文件的当前快照。`null` 表示文件当前不存在。
 * @param options 配置项。
 * @returns 一个包含 promise 和 dispose 方法的对象。
 */
export function whenFileChanged(filePath: string, currentSnap: Snapshot, options: {strategy?: "stat"; interval?: number; initEvent?: boolean} = {}) {
  const controller = new AbortController();
  const {signal} = controller;

  const promise = new Promise<FileChangeEvent>(async (resolve, reject) => {
    signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));

    const fs = await getEasyFs();

    const getSnapshot = async (path: string): Promise<Snapshot> => {
      try {
        const statResult = await fs.stat(path);
        // 确保我们只处理文件，目录被视为不存在
        if (statResult.isFile) {
          return {mtime: statResult.lastModified, size: statResult.size};
        }
        return null;
      } catch (e) {
        // 假设 stat 失败（特别是 NotFoundError）意味着文件不存在
        return null;
      }
    };

    const {initEvent = false, interval = 500} = options;

    // 如果是初始化事件，立即获取状态并返回
    if (initEvent) {
      const initialSnap = await getSnapshot(filePath);
      resolve({event: "init", newSnap: initialSnap});
      return;
    }

    // 进入轮询模式
    while (!signal.aborted) {
      const latestSnap = await getSnapshot(filePath);

      // 使用 JSON.stringify 进行简单而有效的快照比较
      const hasChanged = JSON.stringify(latestSnap) !== JSON.stringify(currentSnap);

      if (hasChanged) {
        if (latestSnap && !currentSnap) {
          resolve({event: "add", newSnap: latestSnap});
          return; // 解决后退出循环
        }
        if (!latestSnap && currentSnap) {
          resolve({event: "delete", newSnap: null});
          return;
        }
        if (latestSnap && currentSnap) {
          resolve({event: "modify", newSnap: latestSnap});
          return;
        }
      }

      // 等待下一个间隔
      await delay(interval);
    }
  });

  return {
    promise,
    dispose() {
      controller.abort();
    },
  };
}
