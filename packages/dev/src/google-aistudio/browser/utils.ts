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
export const raq = () => new Promise((cb) => requestAnimationFrame(cb));

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
