import {prepareDirHandle} from "../../google-aistudio/browser/utils.js";
import {keepWeakup} from "./keepWeakup.js";
import {sync} from "./sync.js";

(async () => {
  const aborted = await prepareDirHandle().then(
    () => false,
    (e) => {
      if (e instanceof Error && e.name === "AbortError") {
        return true;
      }
    },
  );

  if (aborted) {
    console.warn("用户取消了脚本运行");
    return;
  }

  // 启动同步循环
  void sync();
  void keepWeakup();
})();
