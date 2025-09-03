import {$, easy$, while$} from "../utils.js";

/**
 * 获取当前页面选择的模型ID。
 */
export const getPageModel = async (): Promise<string | null> => {
  const modelButton = await while$<HTMLButtonElement>("ms-prompt-run-settings ms-model-selector-v3>button");
  const modelId = modelButton.querySelector(".model-title-text")?.textContent?.trim();
  return modelId || null;
};

/**
 * 获取当前页面设置的系统提示词。
 */
export const getPageSystemPrompt = async (): Promise<string | null> => {
  const btn = await while$<HTMLButtonElement>('button[aria-label="System instructions"]');
  const inputClosed = btn.ariaDisabled !== "false";
  if (inputClosed) {
    btn.click();
  }
  const textareaEle = await while$<HTMLTextAreaElement>("ms-system-instructions>textarea");
  const systemPrompt = textareaEle.value;
  if (inputClosed) {
    btn.click();
  }
  return systemPrompt;
};

/**
 * 获取当前页面设置的Function Call工具。
 */
export const getPageFunctionCallTools = async (): Promise<any[] | null> => {
  const functionCallingSwitch = $<HTMLButtonElement>('button[role="switch"][aria-label="Function calling"]');
  if (!functionCallingSwitch || functionCallingSwitch.ariaChecked !== "true") {
    return null; // Function calling is disabled.
  }

  await easy$<HTMLButtonElement>(`button[aria-label="Edit function declarations"][aria-disabled="false"]`).click();

  const textareaEle = await while$<HTMLTextAreaElement>('ms-tab[label="Code Editor"] ms-text-editor>textarea');
  const toolsJson = textareaEle.value;

  // Close the dialog
  await easy$<HTMLButtonElement>(`button[aria-label="Close the dialog"]`).click();

  try {
    return JSON.parse(toolsJson);
  } catch (e) {
    console.error("JIXO: Failed to parse function call tools JSON.", e);
    return null;
  }
};

/**
 * 从页面读取所有相关配置并聚合成一个对象。
 */
export const getPageConfig = async () => {
  const [model, systemPrompt, tools] = await Promise.all([getPageModel(), getPageSystemPrompt(), getPageFunctionCallTools()]);

  return {
    model,
    systemPrompt,
    tools,
  };
};
