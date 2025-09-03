import {func_throttle} from "@gaubee/util";
import {convertMessages} from "./converter.js";
import {$, delay, getTargetNamespace, prepareDirHandle, styles} from "./utils.js";

export const syncOutput = async (signal?: AbortSignal) => {
  if (signal?.aborted) {
    console.log("JIXO BROWSER: syncOutput aborted before starting.");
    return;
  }
  const abortController = new AbortController();
  const internalSignal = abortController.signal;

  // Link external signal if provided
  signal?.addEventListener(
    "abort",
    () => {
      console.log("JIXO BROWSER: syncOutput aborted.");
      abortController.abort();
    },
    {once: true},
  );

  let preRaw = "";
  const onChange = func_throttle(
    async (raw) => {
      if (internalSignal.aborted) return;
      const newRaw = JSON.stringify(raw);
      if (preRaw !== newRaw) {
        preRaw = newRaw;
        await runFileCreation(await convertMessages(raw));
      }
    },
    200,
    {before: true, waitPromise: true},
  );

  const arr_push = Array.prototype[Symbol.for("arr_push") as any] || Array.prototype.push;
  Array.prototype[Symbol.for("arr_push") as any] = arr_push;
  Array.prototype.push = function push(...args) {
    const a = args[0];
    let isMatched = false;
    if (this.length > 1 && a && Object.getPrototypeOf(a) === Object.prototype && a.role && a.id && typeof a.text === "string") {
      isMatched = true;
    }
    const res = arr_push.apply(this, args);
    if (isMatched && !internalSignal.aborted) {
      try {
        onChange(structuredClone(this));
      } catch {}
    }
    return res;
  };

  const findInput = () => $<HTMLTextAreaElement>(`textarea[aria-label="Start typing a prompt"]`);
  while (!internalSignal.aborted) {
    const input = findInput();
    if (input) {
      input.dispatchEvent(new Event("input"));
    }
    await delay(300);
  }
};

async function runFileCreation(b: any, targetFilename = getTargetNamespace() + ".contents.json") {
  try {
    const rootDirHandle = await prepareDirHandle();
    const fileHandle = await rootDirHandle.getFileHandle(targetFilename, {create: true});
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(b));
    await writable.close();
    console.log(`%c   - ✅ File written: %c${targetFilename}`, styles.success, styles.code);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      console.warn("%c⚠️ User cancelled folder selection.", styles.warn);
    } else {
      console.error("%c❌ Error writing file:", styles.error, error);
    }
  }
}
