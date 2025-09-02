async function injectContentScript(tabId: number) {
  try {
    const r1 = await chrome.scripting.executeScript({
      target: {tabId: tabId},
      func: async (url) => {
        try {
          await import(url);
          return 1;
        } catch (e: any) {
          return e.message;
        }
      },
      world: "MAIN",
      args: [chrome.runtime.getURL("content-script/main.js")],
    });
    const r2 = await chrome.scripting.executeScript({
      target: {tabId: tabId},
      func: async (url) => {
        await import(url);
        return 2;
      },
      world: "ISOLATED",
      args: [chrome.runtime.getURL("content-script/isolated.js")],
    });

    console.log("注入成功：", r1, r2);
  } catch (e) {
    console.error("注入失败：", e);
  }
}

export const setupContentScriptInjecter = () => {
  chrome.runtime.onInstalled.addListener(async () => {
    // 1. 获取所有已打开的标签页
    const tabs = await chrome.tabs.query({});

    // 2. 过滤出需要注入的
    const targetTabs = tabs.filter((t) => t.url && t.url.startsWith("https://aistudio.google.com/"));

    // 3. 注入
    for (const tab of targetTabs) {
      const tabId = tab.id;
      if (tabId == null) {
        continue;
      }
      void injectContentScript(tabId);
    }
  });

  chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (tab.url && tab.url.startsWith("https://aistudio.google.com/")) {
      injectContentScript(tabId);
    }
  });
};
