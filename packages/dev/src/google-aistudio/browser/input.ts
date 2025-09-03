import {delay, getTargetNamespace, prepareDirHandle} from "./utils.js";

const fillFunctionCall = async (signal?: AbortSignal) => {
  if (signal?.aborted) return;
  const rootDirHandle = await prepareDirHandle();
  const targetName = getTargetNamespace();
  const keys = await arrayFromAsync(rootDirHandle.keys());
  const callTaskname = keys.find((key) => key.endsWith(".function_call.json") && key.startsWith(targetName));
  if (!callTaskname) {
    return;
  }

  const taskFileHandle = await rootDirHandle.getFileHandle(callTaskname);
  const taskFile = await taskFileHandle.getFile();
  const taskResponse = JSON.parse(await taskFile.text());
  if (!taskResponse.output) {
    return;
  }

  const scrollToBottom = async () => {
    const chatContainerEle = document.querySelector<HTMLDivElement>("ms-autoscroll-container");
    if (chatContainerEle) {
      chatContainerEle.scrollTo({top: chatContainerEle.scrollHeight - chatContainerEle.clientHeight, behavior: "smooth"});
    }
    await delay(1000);
  };

  const findFunctionCallResponseTextareaEle = () => document.querySelector<HTMLInputElement>('textarea[placeholder="Enter function response"]');

  const waitFunctionCallResponseTextareaEle = async () => {
    while (!signal?.aborted) {
      const ele = findFunctionCallResponseTextareaEle();
      if (ele) {
        return ele;
      }
      await scrollToBottom();
    }
    return null;
  };
  const textareaEle = await waitFunctionCallResponseTextareaEle();
  if (!textareaEle || textareaEle.disabled) {
    return;
  }
  textareaEle.value = typeof taskResponse.output === "string" ? taskResponse.output : JSON.stringify(taskResponse.output, null, 2);
  textareaEle.dispatchEvent(new Event("input"));

  await delay(150);

  const findFunctionCallResponseButtonEle = () => textareaEle.parentElement?.querySelector("button");
  const waitFunctionCallResponseButtonEle = async () => {
    while (!signal?.aborted) {
      const ele = findFunctionCallResponseButtonEle();
      if (ele) {
        if (ele.disabled === false && ele.ariaDisabled !== "true") {
          return ele;
        } else {
          await delay(100);
          continue;
        }
      }
      await scrollToBottom();
    }
    return null;
  };
  const buttonEle = await waitFunctionCallResponseButtonEle();
  if (buttonEle) {
    buttonEle.click();
    await rootDirHandle.removeEntry(callTaskname);
  }
};

export const syncInput = async (signal?: AbortSignal, fps = 3) => {
  if (signal?.aborted) {
    console.log("JIXO BROWSER: syncOutput aborted before starting.");
    return
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
