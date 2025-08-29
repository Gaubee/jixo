import {syncInput} from "./input.js";
import {syncOutput} from "./output.js";
import {prepareDirHandle} from "./utils.js";

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

  void syncOutput();
  void syncInput();
})();
