const JIXO_ORIGIN = "https://aistudio.google.com";

const ALLOWED_URL_PATTERNS = [
  `${JIXO_ORIGIN}/*`,
];

// 检查给定 URL 是否与允许的模式匹配
function isUrlAllowed(url: string) {
  return ALLOWED_URL_PATTERNS.some(pattern => {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return regex.test(url);
  });
}
/**
 * Initializes all listeners related to the side panel's behavior.
 */
export function initializeSidePanel(): void {
  // chrome.runtime.onInstalled.addListener(() => {
  //   chrome.contextMenus.create({
  //     id: "openSidePanel",
  //     title: "Open side panel",
  //     contexts: ["all"],
  //   });
  // });

  // chrome.contextMenus.onClicked.addListener((info, tab) => {
  //   if (info.menuItemId === "openSidePanel") {
  //     // This will open the panel in all the pages on the current window.
  //     chrome.sidePanel.open({windowId: tab!.windowId});
  //   }
  // });
  // chrome.runtime.onInstalled.addListener(() => {
  //   // Disable the side panel globally by default.
  //   chrome.sidePanel.setOptions({enabled: false});
  //   console.log("JIXO BG: Side panel globally disabled by default.");
  // });

  chrome.sidePanel
    //
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error(error));



  // 根据 URL 启用或禁用 Side Panel
  async function updateSidePanel(tabId: number, url: string) {
    if (isUrlAllowed(url)) {
      console.log("open sidepanel")
      await chrome.sidePanel.setOptions({
        tabId: tabId,
        path: "sidepanel.html",
        enabled: true
      });
      // 注意：setOptions 只是启用 Side Panel 的可用性，
      // 它不会自动打开 Side Panel。用户仍然需要点击扩展图标来打开它。
      // 如果你想在特定页面加载时自动打开，需要用户手势或在内容脚本中触发。
      // chrome.sidePanel.open() 需要用户手势才能触发 [2]。
    } else {
      console.log("close sidepanel")
      await chrome.sidePanel.setOptions({
        tabId: tabId,
        enabled: false
      });
    }
  }

  // 监听标签页更新事件
  chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.url && tab.active) { // 确保只处理活动标签页的 URL 变化
      await updateSidePanel(tabId, changeInfo.url);
    }
  });

  // 监听标签页激活事件（当用户切换标签页时）
  chrome.tabs.onActivated.addListener(async (activeInfo) => {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab.url) {
      await updateSidePanel(activeInfo.tabId, tab.url);
    }
  });
  // 首次安装时，为所有现有标签页设置 Side Panel 状态
  chrome.runtime.onInstalled.addListener(async () => {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (tab.url) {
        const tabId = tab.id
        if (tabId != null) {
          await updateSidePanel(tabId, tab.url);
        }
      }
    }
  });

  console.log("JIXO BG: Side panel listeners initialized.");
}
