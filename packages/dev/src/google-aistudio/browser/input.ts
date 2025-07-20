import {arrayFromAsync, delay, getTargetNamespace, prepareDirHandle} from "./utils.js";
const fillFunctionCall = async () => {
  const rootDirHandle = await prepareDirHandle();
  const targetName = getTargetNamespace();
  const keys = await arrayFromAsync(rootDirHandle.keys());
  const callTaskname = keys.find((key) => key.endsWith(".function_call.json") && key.startsWith(targetName));
  if (!callTaskname) {
    return;
  }
  //   const callDoneTaskname = callTaskname.replace(".function_call.json", ".function_call.done");
  //   if (keys.includes(callDoneTaskname)) {
  //     return;
  //   }
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
    while (true) {
      const ele = findFunctionCallResponseTextareaEle();
      if (ele) {
        return ele;
      }
      await scrollToBottom();
    }
  };
  const textareaEle = await waitFunctionCallResponseTextareaEle();
  if (textareaEle.disabled) {
    return;
  }
  textareaEle.value = JSON.stringify(taskResponse.output, null, 2);
  textareaEle.dispatchEvent(new Event("input"));

  await delay(150);

  const findFunctionCallResponseButtonEle = () => document.querySelector<HTMLButtonElement>(`button[mattooltip="Send response"]`);
  const waitFunctionCallResponseButtonEle = async () => {
    while (true) {
      const ele = findFunctionCallResponseButtonEle();
      if (ele) {
        return ele;
      }
      await scrollToBottom();
    }
  };
  const buttonEle = await waitFunctionCallResponseButtonEle();
  buttonEle.click();
  //   await rootDirHandle.getFileHandle(callDoneTaskname, {create: true});
  await rootDirHandle.removeEntry(callTaskname);
};
export const syncInput = async () => {
  void (async () => {
    while (true) {
      await fillFunctionCall().catch(console.error);
      await delay(500);
    }
  })();
};
