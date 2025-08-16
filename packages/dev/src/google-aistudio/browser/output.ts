import {func_throttle} from "@gaubee/util";
import {$, delay, getTargetNamespace, prepareDirHandle, styles} from "./utils.js";

export const syncOutput = async () => {
  const onChange = func_throttle(runFileCreation, 200, {
    before: true,
    waitPromise: true,
  });

  const arr_push = Array.prototype[Symbol.for("arr_push") as any] || Array.prototype.push;
  Array.prototype[Symbol.for("arr_push") as any] = arr_push;
  Array.prototype.push = function push(...args) {
    const a = args[0];
    if (
      a &&
      /// 确定是普通的object
      Object.getPrototypeOf(a) === Object.prototype &&
      // 确定要有必要的属性
      a.role &&
      a.id &&
      typeof a.text === "string"
    ) {
      onChange(this);
    }
    return arr_push.apply(this, args);
  };

  const findInput = () => $<HTMLTextAreaElement>(`textarea[aria-label="Start typing a prompt"]`);
  while (!started) {
    const input = findInput();
    if (input) {
      input.dispatchEvent(new Event("input"));
      started = true;
    }
    await delay(300);
  }
};
let started = false;

let writting = false;
async function runFileCreation(b: any, targetFilename = getTargetNamespace() + ".contents.json") {
  started = true;
  if (writting) {
    return;
  }
  writting = true;

  try {
    const rootDirHandle = await prepareDirHandle();
    if (!rootDirHandle) {
      return;
    }
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
  } finally {
    writting = false;
  }
}
