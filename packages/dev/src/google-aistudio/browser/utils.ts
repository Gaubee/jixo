let rootDirHandle: FileSystemDirectoryHandle | undefined;

/**
 * Sets the global directory handle for the browser session.
 * @param handle - The handle obtained from `showDirectoryPicker`.
 */
export function setDirHandle(handle: FileSystemDirectoryHandle): void {
  rootDirHandle = handle;
}

/**
 * Retrieves the currently stored directory handle.
 * @returns The stored handle or undefined if not set.
 */
export function getDirHandle(): FileSystemDirectoryHandle | undefined {
  return rootDirHandle;
}

// This is now a legacy function, we keep it for reference but new code should use set/get.
export const prepareDirHandle = async (): Promise<FileSystemDirectoryHandle> => {
  if (rootDirHandle) {
    return rootDirHandle;
  }
  rootDirHandle = await window.showDirectoryPicker({mode: "readwrite"});
  return rootDirHandle;
};

// ... (rest of the file remains the same)

export const styles = {
  header: "color: #4CAF50; font-size: 18px; font-weight: bold; border-bottom: 2px solid #4CAF50; padding-bottom: 5px;",
  info: "color: #2196F3; font-style: italic;",
  success: "color: #8BC34A; font-weight: bold;",
  error: "color: #F44336; font-weight: bold;",
  code: "background-color: #f0f0f0; color: #333; padding: 2px 4px; border-radius: 3px; font-family: monospace;",
  warn: "color: #FFC107;",
};

export const arrayFromAsync = async <T,>(iter: AsyncIterableIterator<T>) => {
  const arr: T[] = [];
  for await (const item of iter) {
    arr.push(item);
  }
  return arr;
};

export const getTargetNamespace = () => location.pathname.split("/").at(-1)!;
export const delay = (ms: number) => new Promise((cb) => setTimeout(cb, ms));
export const raf = () => new Promise((cb) => requestAnimationFrame(cb));
export const $ = document.querySelector.bind(document) as typeof document.querySelector;
export const $$ = document.querySelectorAll.bind(document) as typeof document.querySelectorAll;
