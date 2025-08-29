import {func_catch, func_remember} from "@gaubee/util";
import {prepareDirHandle} from "./utils.js";
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
