import {$, easy$, raf, untilRaf, while$, whileRaf} from "../utils.js";
import {getPageModel} from "./reader.js";
import type {PageToolConfig} from "./types.js";

/**
 * 设置Function Call工具。
 * @param tools - 一个符合JSON Schema格式的工具数组。
 */
export const setPageFunctionCallTools = async (tools: PageToolConfig[]) => {
  const switchBtn = async (label: string, enable: boolean) => {
    const btn = $<HTMLButtonElement>(`button[role="switch"][aria-label="${label}"]`);
    if (btn) {
      if (btn.ariaChecked == null) {
        btn.click();
        await untilRaf(() => btn.ariaChecked != null);
      }
      if (btn.ariaChecked != enable.toString()) {
        btn.click();
        await untilRaf(() => btn.ariaChecked == enable.toString());
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

  /// 确保开启
  await switchFunctionCalling(true);

  /// 打开FunctionCall配置面板
  await easy$<HTMLButtonElement>(`button[aria-label="Edit function declarations"][aria-disabled="false"]`).click();

  const textareaEle = await while$<HTMLTextAreaElement>('ms-tab[label="Code Editor"] ms-text-editor>textarea');
  textareaEle.value = JSON.stringify(
    tools.filter((t) => !t.disabled),
    null,
    2,
  );
  textareaEle.dispatchEvent(new Event("input"));

  await easy$<HTMLButtonElement>(`button[aria-label="Save the current function declarations"]`).click();
};

export const usingSettingPanel = async (callback: () => Promise<void>) => {
  await untilRaf(() => {
    return !!($('button[aria-label="Toggle run settings panel"]') || $("ms-run-settings"));
  });
  const toggleBtn = $<HTMLButtonElement>('button[aria-label="Toggle run settings panel"]');
  if (toggleBtn) {
    toggleBtn.click();
  }
  await untilRaf(() => $("ms-run-settings") != null);
  await callback();
  if (toggleBtn) {
    await easy$<HTMLButtonElement>('button[aria-label="Close run settings panel"]').click();
    await while$('button[aria-label="Toggle run settings panel"]');
  }
};

/**
 * 设置系统提示词。
 * @param system - 要设置的系统提示词字符串。
 */
export const setPageSystemPrompt = async (system: string) => {
  const btn = await while$<HTMLButtonElement>('button[aria-label="System instructions"]');
  const inputClosed = $("ms-system-instructions>textarea") == null;
  if (inputClosed) {
    btn.click();
  }
  const textareaEle = await while$<HTMLTextAreaElement>("ms-system-instructions>textarea");
  textareaEle.value = system;
  textareaEle.dispatchEvent(new Event("input"));
  if (inputClosed) {
    btn.click();
    await untilRaf(() => $("ms-system-instructions>textarea") == null);
  }
};

/**
 * 设置使用的模型。
 * @param modelId - 模型的ID或部分名称。
 */
export const setPageModel = async (modelId: string) => {
  const btn = await while$<HTMLButtonElement>("ms-prompt-run-settings ms-model-selector-v3>button");

  if ((await getPageModel()) === modelId) {
    return;
  }

  if ($("ms-model-carousel") === null) {
    btn.click();
  }
  const modelCarouselEle = await while$<HTMLDivElement>("ms-model-carousel");

  const modelCategoriesBtnEle = [...modelCarouselEle.querySelectorAll<HTMLButtonElement>(".model-categories-container button")].find((ele) => {
    return ele.textContent?.trim() === "All";
  });
  if (modelCategoriesBtnEle) {
    modelCategoriesBtnEle.click();
    untilRaf(() => modelCategoriesBtnEle.ariaSelected === "true");
  }

  const models = [...modelCarouselEle.querySelectorAll("ms-model-carousel-row")].map((ele) => {
    return {
      name: ele.querySelector(".model-title")?.textContent?.trim(),
      id: ele.querySelector(".model-subtitle")?.textContent?.trim(),
      btn: ele.querySelector("button"),
      ele,
    };
  });
  const model = models.find((model) => model.name === modelId || model.id === modelId) || models.find((model) => model.id?.includes(modelId) || model.name?.includes(modelId));
  if (model?.btn) {
    model.btn.click();
    await untilRaf(() => model.ele.classList.contains("selected"));
  } else {
    /// 如果没有找到，那么直接点击原本已经选中的，来关闭面板
    modelCarouselEle.querySelector<HTMLButtonElement>("ms-model-carousel-row.selected button")?.click();
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

export const setTitleAndDescription = async (config: {title?: string; description?: string}) => {
  await while$("ms-toolbar");
  let needResize = null == $<HTMLButtonElement>('button[mattooltip="Edit title and description"]');
  if (needResize) {
    document.body.style.width = "1200px!important";
  }
  const btn = await while$<HTMLButtonElement>('button[mattooltip="Edit title and description"]');
  btn.click();
  const dialog = await while$<HTMLElement>("ms-save-prompt-dialog");
  if (config.title != null) {
    const titleInput = await while$<HTMLInputElement>('input[aria-label="Prompt name text field"]');
    titleInput.value = config.title;
    titleInput.dispatchEvent(new Event("input"));
  }
  if (config.description != null) {
    const descriptionInput = await while$<HTMLTextAreaElement>('textarea[aria-label="Prompt description text field"]');
    descriptionInput.value = config.description;
    descriptionInput.dispatchEvent(new Event("input"));
  }

  const saveBtn = await while$<HTMLButtonElement>('button[aria-label="Save title and description"]');
  saveBtn.click();

  await whileRaf(() => document.body.contains(dialog));

  if (needResize) {
    document.body.style.removeProperty("width");
  }
};
