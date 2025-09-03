import type {z} from "../../node/z-min.js";
import {$, easy$, raf, while$, whileRaf} from "../utils.js";

/**
 * 设置Function Call工具。
 * @param tools - 一个符合JSON Schema格式的工具数组。
 */
export const setPageFunctionCallTools = async (tools: z.core.JSONSchema.BaseSchema[]) => {
  const switchBtn = async (label: string, enable: boolean) => {
    const btn = $<HTMLButtonElement>(`button[role="switch"][aria-label="${label}"]`);
    if (btn) {
      if (btn.ariaChecked == null) {
        btn.click();
        await whileRaf(() => btn.ariaChecked != null);
      }
      if (btn.ariaChecked != enable.toString()) {
        btn.click();
        await whileRaf(() => btn.ariaChecked == enable.toString());
      }
    }
  };
  // 首先找到所有相关的设置按钮
  const switchStructuredOutput = (enable: boolean) => switchBtn("Structured output", enable);
  const switchCodeExecution = (enable: boolean) => switchBtn("Code execution", enable);
  const switchFunctionCalling = (enable: boolean) => switchBtn("Function calling", enable);
  const switchGoogleSearch = (enable: boolean) => switchBtn("Grounding with Google Search", enable);
  const switchUrlContext = (enable: boolean) => switchBtn("Browse the url context", enable);

  await Promise.all([
    /// 重置所有设置
    switchStructuredOutput(false),
    switchCodeExecution(false),
    switchFunctionCalling(true),
    switchGoogleSearch(false),
    switchUrlContext(false),
  ]);

  /// 打开FunctionCall配置面板
  await easy$<HTMLButtonElement>(`button[aria-label="Edit function declarations"][aria-disabled="false"]`).click();

  const textareaEle = await while$<HTMLTextAreaElement>('ms-tab[label="Code Editor"] ms-text-editor>textarea');
  textareaEle.value = JSON.stringify(tools, null, 2);
  textareaEle.dispatchEvent(new Event("input"));

  await easy$<HTMLButtonElement>(`button[aria-label="Save the current function declarations"]`).click();
};

/**
 * 设置系统提示词。
 * @param system - 要设置的系统提示词字符串。
 */
export const setPageSystemPrompt = async (system: string) => {
  const btn = await while$<HTMLButtonElement>('button[aria-label="System instructions"]');
  const inputClosed = btn.ariaDisabled !== "false";
  if (inputClosed) {
    btn.click();
  }
  const textareaEle = await while$<HTMLTextAreaElement>("ms-system-instructions>textarea");
  textareaEle.value = system;
  textareaEle.dispatchEvent(new Event("input"));
  if (inputClosed) {
    btn.click();
    await whileRaf(() => btn.ariaDisabled !== "false");
  }
};

/**
 * 设置使用的模型。
 * @param modelId - 模型的ID或部分名称。
 */
export const setPageModel = async (modelId: string) => {
  const btn = await while$<HTMLButtonElement>("ms-prompt-run-settings ms-model-selector-v3>button");

  if ($("ms-model-carousel") === null) {
    btn.click();
  }
  const modelCarouselEle = await while$<HTMLDivElement>("ms-model-carousel");

  const modelCategoriesBtnEle = [...modelCarouselEle.querySelectorAll<HTMLButtonElement>(".model-categories-container button")].find((ele) => {
    return ele.textContent?.trim() === "All";
  });
  if (modelCategoriesBtnEle) {
    modelCategoriesBtnEle.click();
    whileRaf(() => modelCategoriesBtnEle.ariaSelected === "true");
  }

  const models = [...modelCarouselEle.querySelectorAll("ms-model-carousel-row")].map((ele) => {
    return {
      name: ele.querySelector(".model-title")?.textContent?.trim(),
      id: ele.querySelector(".model-title-text")?.textContent?.trim(),
      btn: ele.querySelector("button"),
      ele,
    };
  });
  const model = models.find((model) => model.name === modelId || model.id === modelId) || models.find((model) => model.id?.includes(modelId) || model.name?.includes(modelId));
  if (model?.btn) {
    model.btn.click();
    await whileRaf(() => model.ele.classList.contains("selected"));
  }
};

/**
 * 清理历史记录。
 */
export const clearPageHistory = async () => {
  while (true) {
    const btn = $<HTMLButtonElement>("ms-chat-turn-options button");
    if (btn == null) {
      break;
    }
    btn.click();
    await raf();
    {
      const deleteBtnEle = await while$<HTMLButtonElement>(".mat-mdc-menu-panel > div > button:nth-child(1)");
      deleteBtnEle.click();
    }
    await raf();
  }
};
