import {aFollowedByB, getTargetNamespace, prepareDirHandle, styles} from "./utils.js";

//@ts-check
export const syncOutput = () => {
  // 修改前端 get code 按钮 和 面板
  const styleEle = document.createElement("style");
  const headEle = document.querySelector("head")!;
  const css = String.raw;
  // 隐藏 GetCode 面板，禁止 GetCode 按钮被用户点击
  styleEle.innerText = css`
    .cdk-global-overlay-wrapper:has(.get-code-dialog) {
      display: none;
    }
    button[aria-label="Get code"] {
      pointer-events: none;
    }
  `.replaceAll("\n", "");
  headEle.appendChild(styleEle);

  const findCdkOverlayContainer = () => document.querySelector<HTMLDivElement>(".cdk-overlay-container");
  let cdkOverlayContainer: HTMLDivElement | null
  let off = () => {};
  void setInterval(() => {
    const newCdkOverlayContainer = findCdkOverlayContainer();
    if (newCdkOverlayContainer !== cdkOverlayContainer && newCdkOverlayContainer) {
      off();
      off = aFollowedByB((cdkOverlayContainer = newCdkOverlayContainer), ".cdk-overlay-backdrop", ".cdk-global-overlay-wrapper:has(.get-code-dialog)", (cdkOverlayBackdropEle) => {
        console.log("QAQ", cdkOverlayBackdropEle);
        cdkOverlayBackdropEle.style.display = "none";
      });
    }
  }, 1000);

  // 篡改 get-code 最后的render函数
  const findMustacheKey = () => {
    for (const key in default_MakerSuite) {
      const render = default_MakerSuite[key]?.render;
      if (render && typeof render === "function") {
        return key;
      }
    }
  };
  const waitMustacheKey = async () => {
    while (true) {
      const key = findMustacheKey();
      if (key) {
        return key;
      }
      await new Promise((c) => setTimeout(c, 200));
    }
  };
  async function startInject() {
    const key = await waitMustacheKey();
    const _render = default_MakerSuite[key].render;
    // 请求用户选择一个文件夹
    default_MakerSuite[key].render = (...args: any[]) => {
      const b = args[1];
      void runFileCreation(b);

      // 这里不再调用原来的render，减少性能损耗
      // return render(...args);
      return "";
    };
  }

  // 打开 GetCode 面板且不再关闭
  if (!document.querySelector(".cdk-overlay-container:has(.get-code-dialog)")) {
    const findBtn = () => document.querySelector<HTMLButtonElement>(`button[aria-label="Get code"]`);
    const waitBtn = async () => {
      while (true) {
        const btn = findBtn();
        if (btn) {
          return btn;
        }
        await new Promise((cb) => setTimeout(cb, 200));
      }
    };
    waitBtn().then((getCodeButtonEle) => {
      getCodeButtonEle.click();

      requestAnimationFrame(startInject);
    });
  } else {
    startInject();
  }
};
declare const default_MakerSuite: any;

let writting = false;
async function runFileCreation(b: any, targetFilename = getTargetNamespace() + ".contents.json") {
  if (writting) {
    return;
  }
  writting = true;

  try {
    const rootDirHandle = await prepareDirHandle();
    const fileHandle = await rootDirHandle.getFileHandle(targetFilename, {
      create: true,
    });

    const writable = await fileHandle.createWritable();
    console.log("%c   - 创建可写流成功。", styles.info);

    await writable.write(JSON.stringify(b));
    console.log("%c   - 数据写入中...", styles.info);

    await writable.close();
    console.log(`%c   - ✅ 文件写入并关闭成功: %c${targetFilename}`, styles.success, styles.code);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      console.warn("%c⚠️ 用户取消了文件夹选择操作。流程已中止。", styles.warn);
    } else {
      console.error("%c❌ 发生意外错误:", styles.error, error);
    }
  }
  writting = false;
}
