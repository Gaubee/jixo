import {syncInput} from "./input.js";
import {syncOutput} from "./output.js";

void syncOutput();
void syncInput();

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
