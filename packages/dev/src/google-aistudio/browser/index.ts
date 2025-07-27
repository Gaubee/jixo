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

// import {MyDevPanel} from "./dev-tools-panel.js";

// MyDevPanel.register({
//   id: "sync",
//   text: "🔄 执行同步",
//   description: "点击左侧箭头或属性名来刷新页面",
//   css: "color: #28a745;",
//   action: () => {
//     void syncOutput();
//     void syncInput();
//   },
// });
