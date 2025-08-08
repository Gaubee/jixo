import {func_catch, func_remember} from "@gaubee/util";

let rootDirHandle: FileSystemDirectoryHandle | undefined;
export const prepareDirHandle = async (): Promise<FileSystemDirectoryHandle> => {
  if (rootDirHandle) {
    return rootDirHandle;
  }
  // 1. 请求用户选择一个 *根* 文件夹
  const ti = setTimeout(() => {
    console.log("%c等待用户动作: 请选择一个文件夹，用来作为内容导入导出的协作目录.", styles.info);
  }, 100);
  try {
    rootDirHandle = await window.showDirectoryPicker({mode: "readwrite"});
    console.log(`%c✅ 根文件夹已选择: %c${rootDirHandle.name}`, styles.success, styles.code);
    return rootDirHandle;
  } catch (e) {
    clearTimeout(ti);
    if (e instanceof Error) {
      if (e.name === "SecurityError" || e.name === "NotAllowedError") {
        console.log("%c请将鼠标聚焦到窗口视图中", styles.info);
        await delay(1000);
        return prepareDirHandle();
      }
      if (e.name === "AbortError") {
        throw new DOMException("用户取消了文件夹选择", "AbortError");
        // console.log("%c用户取消了文件夹选择", styles.error);
        // return;
      }
    }
    throw e;
  }
};
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
export type EasyFS = Awaited< ReturnType<typeof getEasyFs>>;
export const styles = {
  header: "color: #4CAF50; font-size: 18px; font-weight: bold; border-bottom: 2px solid #4CAF50; padding-bottom: 5px;",
  info: "color: #2196F3; font-style: italic;",
  success: "color: #8BC34A; font-weight: bold;",
  error: "color: #F44336; font-weight: bold;",
  code: "background-color: #f0f0f0; color: #333; padding: 2px 4px; border-radius: 3px; font-family: monospace;",
  warn: "color: #FFC107;",
};

export const arrayFromAsync = async <T>(iter: AsyncIterableIterator<T>) => {
  const arr: T[] = [];
  for await (const item of iter) {
    arr.push(item);
  }
  return arr;
};

export const getTargetNamespace = () => location.pathname.split("/").at(-1)!;
export const delay = (ms: number) => new Promise((cb) => setTimeout(cb, ms));
export const raf = () => new Promise((cb) => requestAnimationFrame(cb));

/**
 * aFollowedByB
 * 在一级子节点中监听 .a 紧挨着 .b 的兄弟关系
 *
 * @param el        容器元素（只检查其直接子节点）
 * @param cb        关系发生变化时回调 (aEl, hasB) => void
 *                  • hasB === true  : a 后面紧挨着就是 .b
 *                  • hasB === false : 之前成立，现在不成立
 * @return Function 手动停止观察
 */
export const aFollowedByB = (el: HTMLElement, aSelector: string, bSelector: string, cb: (aEle: HTMLElement, bEle: HTMLElement) => void) => {
  const run = () => {
    console.log("QAQ", el);
    for (const bEle of el.querySelectorAll(`:scope > ${aSelector} + ${bSelector}`)) {
      const aEle = bEle.previousElementSibling as HTMLElement;
      cb(aEle, bEle as HTMLElement);
    }
  };

  const mo = new MutationObserver(run);
  mo.observe(el, {childList: true});
  run(); // 立即跑一遍
  return () => mo.disconnect();
};

export const $ = document.querySelector.bind(document) as typeof document.querySelector;
export const $$ = document.querySelectorAll.bind(document) as typeof document.querySelectorAll;
