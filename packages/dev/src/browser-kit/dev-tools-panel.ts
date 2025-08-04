/**
 * DevToolsPanel - 在浏览器开发者工具的Console中创建一个固定的、可交互的UI面板。
 * 这个版本使用 property getter 实现“点击即执行”的功能。
 *
 * @example
 * // 注册一个按钮
 * DevToolsPanel.register({
 *   id: 'reloadBtn',
 *   text: '🔄 刷新页面',
 *   description: '点击左侧箭头或属性名来刷新页面',
 *   css: 'color: #28a745; font-weight: bold;',
 *   action: () => window.location.reload()
 * });
 *
 * // 注册一个清除 LocalStorage 的按钮
 * DevToolsPanel.register({
 *   id: 'clearStorage',
 *   text: '🗑️ 清除LocalStorage',
 *   description: '点击以清除 LocalStorage',
 *   css: 'color: #dc3545;',
 *   action: () => {
 *     localStorage.clear();
 *     DevToolsPanel.log('LocalStorage 已清除!');
 *   }
 * });
 *
 * // 移除按钮
 * DevToolsPanel.unregister('reloadBtn');
 *
 * // 打印一条属于面板的消息
 * DevToolsPanel.log('欢迎使用！');
 */
class DevToolsPanel {
  private static instance: DevToolsPanel;
  private readonly title: string;
  private readonly items: Map<string, PanelItemConfig> = new Map();
  private readonly logs: LogItem[] = [];
  private readonly panelTitleCss: string = "color: #007bff; font-weight: bold; font-size: 1.2em;";
  private readonly logCss: string = "color: #6c757d;";

  private constructor(title = "🛠️ DevTools 功能面板 (点击箭头展开)") {
    this.title = title;
    this.render();
  }

  // 单例模式确保全局只有一个面板实例
  public static getInstance(): DevToolsPanel {
    if (!DevToolsPanel.instance) {
      DevToolsPanel.instance = new DevToolsPanel();
    }
    return DevToolsPanel.instance;
  }

  /**
   * 渲染整个面板到控制台
   */
  private render(): void {
    requestAnimationFrame(() => {
      console.clear();
      console.groupCollapsed(`%c${this.title}`, this.panelTitleCss);

      const actions: {[key: string]: any} = {};
      const styles: string[] = [];
      let logFormatString = "";

      if (this.items.size > 0) {
        this.items.forEach((item) => {
          const buttonKey = `▶ ${item.text}`;
          logFormatString += `%c${buttonKey}%c\n`;
          styles.push(item.css ?? "", "color: unset;"); // 添加按钮样式和换行后的重置样式

          Object.defineProperty(actions, buttonKey, {
            get: () => {
              // 为了防止用户快速连续点击导致问题，我们可以加一个简单的防抖
              // 同时，getter一旦被调用，我们立即重新渲染，以提供反馈
              this.render();
              // 执行核心动作
              item.action();
              // getter 必须返回一个值给 DevTools 显示
              return `✅ [${item.text}] 已执行! - ${item.description || ""}`;
            },
            configurable: true, // 允许我们后续删除或修改这个属性
            enumerable: true,
          });
        });

        // 打印带样式的介绍文本
        console.log(logFormatString, ...styles);
        // 打印带getter的对象，这是实现点击交互的核心
        console.dir(actions);
      } else {
        console.log("%c暂无已注册的操作。", "color: #6c757d; font-style: italic;");
      }

      // 渲染面板内部的日志
      if (this.logs.length > 0) {
        console.group("面板日志");
        this.logs.forEach((log) => console.log(`%c${log.timestamp}:`, this.logCss, ...log.args));
        console.groupEnd();
      }

      console.groupEnd();
    });
  }

  /**
   * 注册一个可交互的项 (按钮) 到面板
   * @param itemConfig - 面板项的配置
   */
  public register(itemConfig: PanelItemConfig): void {
    const {id, text, css, action, description} = itemConfig;

    const defaultCss = "font-family: sans-serif; font-size: 1.1em; cursor: pointer;";

    this.items.set(id, {
      id,
      text,
      css: `${defaultCss} ${css || ""}`,
      action,
      description,
    });
    this.render();
  }

  /**
   * 从面板中移除一个项
   * @param id - 要移除的项的ID
   */
  public unregister(id: string): void {
    if (this.items.has(id)) {
      this.items.delete(id);
      this.render();
    }
  }

  /**
   * 在面板内部打印一条日志
   * @param args - 要打印的消息
   */
  public log(...args: any[]): void {
    const timestamp = new Date().toLocaleTimeString();
    this.logs.push({timestamp, args});
    this.render();
  }

  /**
   * 清除面板内部的所有日志
   */
  public clearLogs(): void {
    this.logs.length = 0;
    this.render();
  }
}

// --- 类型定义 ---
interface PanelItemConfig {
  id: string; // 唯一ID，用于注销
  text: string; // 显示的文本
  action: () => void; // 点击时执行的函数
  css?: string; // 自定义CSS样式
  description?: string; // 显示在getter返回值中的描述信息
}

interface LogItem {
  timestamp: string;
  args: any[];
}

// --- 使用示例 ---
export const MyDevPanel = DevToolsPanel.getInstance();

MyDevPanel.register({
  id: "reloadPage",
  text: "🔄 刷新页面",
  description: "点击左侧箭头或属性名来刷新页面",
  css: "color: #28a745;",
  action: () => window.location.reload(),
});

MyDevPanel.register({
  id: "clearStorage",
  text: "🗑️ 清除 LocalStorage",
  description: "清除网站的 LocalStorage 数据",
  css: "color: #dc3545;",
  action: () => {
    localStorage.clear();
    MyDevPanel.log("LocalStorage 已被清除！");
  },
});

MyDevPanel.register({
  id: "logUser",
  text: "👤 打印用户信息",
  description: "在面板日志中打印模拟的用户对象",
  css: "color: #ffc107;",
  action: () => {
    const user = {name: "Alex", id: 123, roles: ["admin", "editor"]};
    MyDevPanel.log("当前用户信息:", user);
  },
});

// 3. 注册一个打印用户信息的按钮
MyDevPanel.register({
  id: "clearLog",
  text: "清理打印",
  css: "background: #ffc107; color: black;",
  action: () => {
    MyDevPanel.clearLogs();
  },
});

// 你可以在控制台随时调用
// MyDevPanel.unregister('logUser'); // 移除按钮
// MyDevPanel.log('这是一条自定义消息', {a: 1, b: 2}); // 打印日志
// MyDevPanel.clearLogs(); // 清空日志
