const JIXO_ORIGIN = "https://aistudio.google.com";

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
    .setPanelBehavior({openPanelOnActionClick: true})
    .catch((error) => console.error(error));

  // This listener is the primary mechanism for enabling the side panel.
  // It ensures that whenever a tab is updated to a matching URL, the panel is enabled for it.
  chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {
    if (!tab.url) return;
    const url = new URL(tab.url);

    if (url.origin === JIXO_ORIGIN) {
      await chrome.sidePanel.setOptions({
        tabId,
        enabled: true,
      });
    } else {
      await chrome.sidePanel.setOptions({
        tabId,
        enabled: false,
      });
    }
  });

  console.log("JIXO BG: Side panel listeners initialized.");
}
