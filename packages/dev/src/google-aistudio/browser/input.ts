import {$$, delay, getTargetNamespace, prepareDirHandle, untilRaf, while$} from "./utils.js";

const fillFunctionCall = async (signal?: AbortSignal) => {
  if (signal?.aborted) return;
  const rootDirHandle = await prepareDirHandle();
  const targetName = getTargetNamespace();
  const keys = await arrayFromAsync(rootDirHandle.keys());
  for (const callTaskname of keys.filter((key) => key.endsWith(".function_call.json") && key.startsWith(targetName))) {
    if (signal?.aborted) return;
    const taskFileHandle = await rootDirHandle.getFileHandle(callTaskname);
    const taskFile = await taskFileHandle.getFile();
    const taskResponse: {
      name: string;
      parameters: string;
      input: object;
      output: string | unknown;
    } = JSON.parse(await taskFile.text());
    /// 如果已经有output，那么两种情况：一种是用户正在输入，一种是已经输入
    if (!taskResponse.output) {
      return;
    }

    /// 滚动到最后一次交谈的地方
    const scrollbarEle = await while$("ms-prompt-scrollbar", {signal});
    const anthorButtons = [...scrollbarEle.querySelectorAll("button")];
    const lastBtn = anthorButtons.at(-1);
    if (lastBtn) {
      lastBtn.click();
      await untilRaf(() => lastBtn.classList.contains("ms-button-active"));
    }

    const functionCallEles = [...$$<HTMLElement>("ms-function-call-chunk")];
    /// 没有找到任何可以进行function-call的输入
    if (functionCallEles.length === 0) {
      console.error("找不到任何可以进行function-call的输入");
      return;
    }

    const functionCallEle = functionCallEles.find(
      (ele) =>
        ele.querySelector("mat-panel-title")?.textContent?.trim() === `function ${taskResponse.name}` &&
        JSON.stringify(JSON.parse(ele.querySelector("code")?.textContent ?? "{}")) === taskResponse.parameters,
    );
    if (null == functionCallEle) {
      console.warn(`找不到指定的可以进行function-call-ele: ${taskResponse.name}(${taskResponse.parameters})`);
      return;
    }

    const responseTextEle = functionCallEle.querySelector<HTMLInputElement>('input[placeholder="Enter function response"]');
    if (!responseTextEle || responseTextEle.disabled) {
      return;
    }
    responseTextEle.value = typeof taskResponse.output === "string" ? taskResponse.output : JSON.stringify(taskResponse.output, null, 2);
    responseTextEle.dispatchEvent(new Event("input"));

    const buttonEle = functionCallEle.querySelector<HTMLButtonElement>("form button");
    if (!buttonEle) {
      return;
    }
    await untilRaf(() => buttonEle.ariaDisabled === "false");
    buttonEle.click();
    await rootDirHandle.removeEntry(callTaskname);
  }
};

export const syncInput = async (signal?: AbortSignal, fps = 3) => {
  if (signal?.aborted) {
    console.log("JIXO BROWSER: syncOutput aborted before starting.");
    return;
  }
  signal?.addEventListener("abort", () => {
    console.log("JIXO BROWSER: syncInput aborted.");
  });
  while (!signal?.aborted) {
    await fillFunctionCall(signal);
    await delay(1000 / fps);
  }
};

// Helper to use in fillFunctionCall
async function arrayFromAsync<T>(iter: AsyncIterable<T>): Promise<T[]> {
  const arr: T[] = [];
  for await (const i of iter) arr.push(i);
  return arr;
}
