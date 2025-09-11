import {abort_signal_merge, async_proxyer, func_remember} from "@gaubee/util";
export * from "./easy_fs.js";

let restoredDirHandle: FileSystemDirectoryHandle | undefined;
export const restoreDirHandle = async (newHandle?: FileSystemDirectoryHandle | null) => {
  if (restoredDirHandle === newHandle) {
    return;
  }
  if ((await newHandle?.queryPermission({mode: "readwrite"})) !== "granted") {
    newHandle = null;
  }
  prepareDirHandle.reset();
  if (newHandle == null) {
    restoredDirHandle = undefined;
  } else {
    console.log(`%c✅ Restored workspace access: %c${newHandle.name}`, styles.success, styles.code);
    restoredDirHandle = newHandle;
  }
};

export const pickDirHandle = async (): Promise<FileSystemDirectoryHandle> => {
  const ti = setTimeout(() => {
    console.log("%c等待用户动作: 请选择一个文件夹", styles.info);
  }, 100);
  try {
    const rootDirHandle = await window.showDirectoryPicker({mode: "readwrite"});
    return rootDirHandle;
  } catch (e) {
    clearTimeout(ti);
    if (e instanceof Error) {
      if (e.name === "SecurityError" || e.name === "NotAllowedError") {
        console.log("%c请将鼠标聚焦到窗口视图中", styles.info);
        await delay(1000);
        return pickDirHandle();
      }
      if (e.name === "AbortError") {
        throw new DOMException("用户取消了文件夹选择", "AbortError");
      }
    }
    throw e;
  } finally {
    clearTimeout(ti);
  }
};

/**
 * Prompts the user to select a directory, but prioritizes a restored handle if provided.
 * @param restoredHandle - An optional, previously stored directory handle.
 * @returns The selected or restored directory handle.
 * @throws An error if the user cancels the prompt.
 */
export const prepareDirHandle = func_remember(async (): Promise<FileSystemDirectoryHandle> => {
  const rootDirHandle = restoredDirHandle ?? (await pickDirHandle());
  console.log(`%c✅ 根文件夹已选择，用来作为内容导入导出的协作目录: %c${rootDirHandle.name}`, styles.success, styles.code);
  return rootDirHandle;
});

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
export interface AbortOptions {
  signal?: AbortSignal;
}
export const delay = (ms: number, {signal}: AbortOptions = {}) =>
  new Promise((resolve, reject) => {
    const ti = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(ti);
      reject(signal.reason);
    });
  });
export const raf = () => new Promise((cb) => requestAnimationFrame(cb));
export const whileRaf = async (condition: () => boolean, {timeout = 3_000, signal}: TimeoutOptions = {}) => {
  const timeoutSignal = createTimeoutSignal(timeout, signal, `whileRaf(${condition.toString()})`);
  while (await condition()) {
    await raf();
    timeoutSignal?.throwIfAborted();
  }
};
export const untilRaf = async (condition: () => boolean, {timeout = 3_000, signal}: TimeoutOptions = {}) => {
  const timeoutSignal = createTimeoutSignal(timeout, signal, `untilRaf(${condition.toString()})`);
  while (!(await condition())) {
    await raf();
    timeoutSignal?.throwIfAborted();
  }
};

interface IntervalTimeoutOptions extends TimeoutOptions {
  frameMs?: number;
}
export const whileDelay = async (condition: () => boolean | Promise<boolean>, {timeout = 30_000, frameMs = 100, signal}: IntervalTimeoutOptions = {}) => {
  const timeoutSignal = createTimeoutSignal(timeout, signal, `whileDelay(${condition.toString()}})`);
  while (await condition()) {
    await delay(frameMs, {signal: timeoutSignal});
  }
};

export const untilDelay = async (condition: () => boolean | Promise<boolean>, {timeout = 30_000, frameMs = 100, signal}: IntervalTimeoutOptions = {}) => {
  const timeoutSignal = createTimeoutSignal(timeout, signal, `untilDelay(${condition})`);
  while (!(await condition())) {
    await delay(frameMs, {signal: timeoutSignal});
  }
};
export const aFollowedByB = (el: HTMLElement, aSelector: string, bSelector: string, cb: (aEle: HTMLElement, bEle: HTMLElement) => void) => {
  const run = () => {
    for (const bEle of el.querySelectorAll(`:scope > ${aSelector} + ${bSelector}`)) {
      const aEle = bEle.previousElementSibling as HTMLElement;
      cb(aEle, bEle as HTMLElement);
    }
  };

  const mo = new MutationObserver(run);
  mo.observe(el, {childList: true});
  run();
  return () => mo.disconnect();
};
export const $ = <E extends Element = Element>(selectors: string) => document.querySelector<E>(selectors);
interface TimeoutOptions extends AbortOptions {
  timeout?: number;
  signal?: AbortSignal;
}

const createTimeoutSignal = (timeout: number, signal: AbortSignal | undefined, reason: string) => {
  // = new Error().stack?.split("\n").slice(2).join("\n") ?? ""
  return abort_signal_merge(
    signal,
    timeout > 0
      ? (() => {
          const abortController = new AbortController();
          const ti = setTimeout(() => {
            abortController.abort(new Error(reason));
          }, timeout);
          signal?.addEventListener("abort", () => clearTimeout(ti));
          return abortController.signal;
        })()
      : null,
  );
};
export const while$ = async <E extends Element = Element>(selectors: string, options: TimeoutOptions = {}) => {
  const {timeout = 3_000, signal} = options;
  const timeoutSignal = createTimeoutSignal(timeout, signal, `while$(${selectors})`);

  while (true) {
    const ele = $<E>(selectors);
    if (ele != null) {
      return ele;
    }
    await raf();
    timeoutSignal?.throwIfAborted();
  }
};
export const easy$ = <E extends Element = Element>(selectors: string, options?: TimeoutOptions) => {
  return async_proxyer(while$<E>(selectors, options));
};
export const $$ = <E extends Element = Element>(selectors: string) => document.querySelectorAll<E>(selectors);
